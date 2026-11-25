import { availabilityFor, conflictFor } from "./availability";
import { fail, succeed, type CommandResult, type OverReceiptLine, type ShortageLine } from "./errors";
import { withIdempotency } from "./idempotency";
import { movementHeader } from "./inventory";
import { can } from "./permissions";
import {
  appendMovement,
  cloneState,
  findArticle,
  findEvent,
  hasText,
  isActiveStatus,
  isPositiveInteger,
  nextId,
  openCommitment,
  pendingReturn,
  stockOf,
  toDispatch,
  windowEnd,
} from "./state";
import type { CommandContext, InventoryState, MovementLine } from "./types";

export interface DispatchLineInput {
  lineId: string;
  quantity: number;
}

/**
 * Registers the effective departure (R1, R4). Returnables move available → out and keep their
 * commitment; consumables move available → consumed and resolve it. Partial dispatch is allowed.
 * The dispatch is tied to the commitment window and refused while the article is over-reserved (R6).
 */
export function dispatchEvent(
  state: InventoryState,
  input: { eventId: string; lines: DispatchLineInput[]; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "dispatch", input, ctx, () => {
    if (!can(ctx.actor, "warehouse.operate")) return fail("forbidden");
    const event = findEvent(state, input.eventId);
    if (!event) return fail("not_found");
    if (!isActiveStatus(event.status)) return fail("invalid_state");
    if (input.lines.length === 0) return fail("nothing_to_register");
    const now = ctx.clock.now();

    const seen = new Set<string>();
    for (const requested of input.lines) {
      const line = event.lines.find((l) => l.id === requested.lineId);
      if (!line) return fail("not_found", { field: "lineId" });
      if (seen.has(line.id)) return fail("duplicate_line");
      seen.add(line.id);
      if (!isPositiveInteger(requested.quantity)) return fail("invalid_quantity", { field: "quantity" });
      if (requested.quantity > toDispatch(line)) return fail("over_dispatch");
      const article = findArticle(state, line.articleId)!;
      if (now >= windowEnd(event, article.kind)) return fail("reservation_expired");
    }

    // A dispatch before the window start moves the start after validating the new part.
    const early: ShortageLine[] = [];
    for (const requested of input.lines) {
      const line = event.lines.find((l) => l.id === requested.lineId)!;
      if (now >= line.windowStart) continue;
      const article = findArticle(state, line.articleId)!;
      const free = availabilityFor(state, article.id, { from: now, to: line.windowStart }, now, { excludeEventId: event.id }).available;
      const needed = openCommitment(line, article.kind);
      if (needed > free) {
        const available = Math.max(0, free);
        early.push({ lineId: line.id, articleId: article.id, requested: needed, available, missing: needed - available });
      }
    }
    if (early.length > 0) return fail("insufficient_availability", { shortages: early });

    const next = cloneState(state);
    const target = findEvent(next, event.id)!;
    for (const requested of input.lines) {
      const line = target.lines.find((l) => l.id === requested.lineId)!;
      if (now < line.windowStart) line.windowStart = now;
    }

    // Resolution before the next dispatch: the article must not be over-reserved in its window.
    const conflicts: ShortageLine[] = [];
    for (const requested of input.lines) {
      const line = target.lines.find((l) => l.id === requested.lineId)!;
      const article = findArticle(next, line.articleId)!;
      const conflict = conflictFor(next, article.id, now, { from: line.windowStart, to: windowEnd(target, article.kind) });
      if (conflict) {
        const needed = openCommitment(line, article.kind);
        conflicts.push({ lineId: line.id, articleId: article.id, requested: needed, available: Math.max(0, needed - conflict.shortage), missing: conflict.shortage });
      }
    }
    if (conflicts.length > 0) return fail("unresolved_conflict", { shortages: conflicts });

    const perArticle = new Map<string, number>();
    for (const requested of input.lines) {
      const line = target.lines.find((l) => l.id === requested.lineId)!;
      perArticle.set(line.articleId, (perArticle.get(line.articleId) ?? 0) + requested.quantity);
    }
    for (const [articleId, quantity] of perArticle) {
      if (stockOf(next, articleId).available < quantity) return fail("insufficient_stock", { field: articleId });
    }

    const header = movementHeader(next, "dispatch", ctx);
    const lines: MovementLine[] = input.lines.map((requested, index) => {
      const line = target.lines.find((l) => l.id === requested.lineId)!;
      const article = findArticle(next, line.articleId)!;
      line.dispatchedQty += requested.quantity;
      const level = stockOf(next, article.id);
      next.stock[article.id] =
        article.kind === "consumable"
          ? { ...level, available: level.available - requested.quantity }
          : { ...level, available: level.available - requested.quantity, out: level.out + requested.quantity };
      return {
        lineNo: index + 1,
        articleId: article.id,
        quantity: requested.quantity,
        from: "available",
        to: article.kind === "consumable" ? "consumed" : "out",
        reservationLineId: line.id,
      };
    });
    appendMovement(next, { ...header, eventId: target.id, lines });
    if (target.status === "confirmed") target.status = "in_progress";
    return succeed(next, { movementId: header.id });
  });
}

export interface ReturnLineInput {
  lineId: string;
  good?: number;
  washing?: number;
  broken?: number;
  lost?: number;
  brokenReason?: string;
  lostReason?: string;
}

type Outcome = "good" | "washing" | "broken" | "lost";
const OUTCOMES: readonly Outcome[] = ["good", "washing", "broken", "lost"];
const TO_BUCKET = { good: "available", washing: "washing", broken: "broken", lost: "lost" } as const;

/**
 * Receives returnable units in parts: good, to washing, broken or lost (R5).
 * Quantities are positive integers, broken and lost need a reason, and cumulative receipts can
 * never exceed what was dispatched: an over-receipt rejects the whole request.
 */
export function registerReturn(
  state: InventoryState,
  input: { eventId: string; lines: ReturnLineInput[]; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "return", input, ctx, () => {
    if (!can(ctx.actor, "warehouse.operate")) return fail("forbidden");
    const event = findEvent(state, input.eventId);
    if (!event) return fail("not_found");
    if (event.status !== "in_progress") return fail("invalid_state");

    let total = 0;
    const overReceipts: OverReceiptLine[] = [];
    const seen = new Set<string>();
    for (const requested of input.lines) {
      const line = event.lines.find((l) => l.id === requested.lineId);
      if (!line) return fail("not_found", { field: "lineId" });
      if (seen.has(line.id)) return fail("duplicate_line");
      seen.add(line.id);
      const article = findArticle(state, line.articleId)!;
      if (article.kind === "consumable") return fail("consumable_return");
      let attempted = 0;
      for (const outcome of OUTCOMES) {
        const value = requested[outcome];
        if (value === undefined || value === 0) continue;
        if (!isPositiveInteger(value)) return fail("invalid_quantity", { field: outcome });
        attempted += value;
      }
      if ((requested.broken ?? 0) > 0 && !hasText(requested.brokenReason)) return fail("reason_required", { field: "brokenReason" });
      if ((requested.lost ?? 0) > 0 && !hasText(requested.lostReason)) return fail("reason_required", { field: "lostReason" });
      const pending = pendingReturn(line, article.kind);
      if (attempted > pending) overReceipts.push({ lineId: line.id, articleId: article.id, pending, attempted });
      total += attempted;
    }
    if (overReceipts.length > 0) return fail("over_receipt", { overReceipts });
    if (total === 0) return fail("nothing_to_register");

    const next = cloneState(state);
    const target = findEvent(next, event.id)!;
    const header = movementHeader(next, "return", ctx);
    const lines: MovementLine[] = [];
    for (const requested of input.lines) {
      const line = target.lines.find((l) => l.id === requested.lineId)!;
      for (const outcome of OUTCOMES) {
        const quantity = requested[outcome] ?? 0;
        if (quantity === 0) continue;
        const movementLine: MovementLine = {
          lineNo: lines.length + 1,
          articleId: line.articleId,
          quantity,
          from: "out",
          to: TO_BUCKET[outcome],
          reservationLineId: line.id,
        };
        if (outcome === "broken") movementLine.reason = requested.brokenReason!.trim();
        if (outcome === "lost") movementLine.reason = requested.lostReason!.trim();
        if (outcome === "washing") {
          const batchId = nextId(next, "lot");
          movementLine.washingBatchId = batchId;
          next.batches.push({
            id: batchId,
            articleId: line.articleId,
            eventId: target.id,
            sourceMovementId: header.id,
            purpose: "washing",
            quantity,
            releasedQty: 0,
            removedQty: 0,
            createdAt: header.occurredAt,
          });
        }
        lines.push(movementLine);
      }
      const good = requested.good ?? 0;
      const washing = requested.washing ?? 0;
      const broken = requested.broken ?? 0;
      const lost = requested.lost ?? 0;
      line.returnedGoodQty += good;
      line.returnedWashingQty += washing;
      line.brokenQty += broken;
      line.lostQty += lost;
      const level = stockOf(next, line.articleId);
      next.stock[line.articleId] = {
        available: level.available + good,
        washing: level.washing + washing,
        out: level.out - (good + washing + broken + lost),
      };
    }
    appendMovement(next, { ...header, eventId: target.id, lines });
    return succeed(next, { movementId: header.id });
  });
}
