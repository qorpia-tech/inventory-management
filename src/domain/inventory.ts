import { conflictFor } from "./availability";
import { fail, succeed, type CommandResult } from "./errors";
import { withIdempotency } from "./idempotency";
import { can } from "./permissions";
import {
  appendMovement,
  cloneState,
  findArticle,
  hasText,
  isNonNegativeInteger,
  isPositiveInteger,
  nextId,
  stockOf,
} from "./state";
import type { ArticleKind, CommandContext, InventoryState, Movement, MovementLine } from "./types";

function movementHeader(state: InventoryState, kind: Movement["kind"], ctx: CommandContext): Omit<Movement, "lines"> {
  return {
    id: nextId(state, "mov"),
    kind,
    locationId: state.locationId,
    recordedBy: { id: ctx.actor.id, name: ctx.actor.name },
    occurredAt: ctx.clock.now(),
  };
}

export function createArticle(
  state: InventoryState,
  input: { sku: string; name: string; category: string; kind: ArticleKind },
  ctx: CommandContext,
): CommandResult<{ articleId: string }> {
  if (!can(ctx.actor, "article.manage")) return fail("forbidden");
  if (!hasText(input.sku)) return fail("validation", { field: "sku" });
  if (!hasText(input.name)) return fail("validation", { field: "name" });
  if (input.kind !== "returnable" && input.kind !== "consumable") return fail("validation", { field: "kind" });
  const sku = input.sku.trim().toUpperCase();
  if (state.articles.some((article) => article.sku.toUpperCase() === sku)) return fail("duplicate_sku", { field: "sku" });

  const next = cloneState(state);
  const articleId = nextId(next, "art");
  next.articles.push({
    id: articleId,
    sku,
    name: input.name.trim(),
    category: hasText(input.category) ? input.category.trim() : "General",
    kind: input.kind,
    createdAt: ctx.clock.now(),
  });
  next.stock[articleId] = { available: 0, washing: 0, out: 0 };
  return succeed(next, { articleId });
}

/** Opening balance, allowed once per article while it has no movements (design §6.4). */
export function registerOpening(
  state: InventoryState,
  input: { articleId: string; available: number; washing: number },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  if (!can(ctx.actor, "stock.opening")) return fail("forbidden");
  const article = findArticle(state, input.articleId);
  if (!article) return fail("not_found");
  if (!isNonNegativeInteger(input.available) || !isNonNegativeInteger(input.washing)) return fail("invalid_quantity");
  if (input.available + input.washing === 0) return fail("nothing_to_register");
  if (state.movements.some((m) => m.lines.some((line) => line.articleId === article.id))) return fail("opening_exists");

  const next = cloneState(state);
  const header = movementHeader(next, "opening", ctx);
  const lines: MovementLine[] = [];
  if (input.available > 0) {
    lines.push({ lineNo: lines.length + 1, articleId: article.id, quantity: input.available, from: "opening", to: "available" });
  }
  if (input.washing > 0) {
    const batchId = nextId(next, "lot");
    lines.push({ lineNo: lines.length + 1, articleId: article.id, quantity: input.washing, from: "opening", to: "washing", washingBatchId: batchId });
    next.batches.push({
      id: batchId,
      articleId: article.id,
      sourceMovementId: header.id,
      purpose: "washing",
      quantity: input.washing,
      releasedQty: 0,
      removedQty: 0,
      createdAt: header.occurredAt,
    });
  }
  appendMovement(next, { ...header, lines });
  const level = stockOf(next, article.id);
  next.stock[article.id] = { ...level, available: level.available + input.available, washing: level.washing + input.washing };
  return succeed(next, { movementId: header.id });
}

export function registerReceipt(
  state: InventoryState,
  input: { articleId: string; quantity: number; note?: string; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "receipt", input, ctx, () => {
    if (!can(ctx.actor, "stock.receipt")) return fail("forbidden");
    const article = findArticle(state, input.articleId);
    if (!article) return fail("not_found");
    if (!isPositiveInteger(input.quantity)) return fail("invalid_quantity", { field: "quantity" });

    const next = cloneState(state);
    const header = movementHeader(next, "receipt", ctx);
    appendMovement(next, {
      ...header,
      reason: hasText(input.note) ? input.note.trim() : undefined,
      lines: [{ lineNo: 1, articleId: article.id, quantity: input.quantity, from: "purchase", to: "available" }],
    });
    const level = stockOf(next, article.id);
    next.stock[article.id] = { ...level, available: level.available + input.quantity };
    return succeed(next, { movementId: header.id });
  });
}

/** Adjustments always carry a reason (spec §2). Negative ones go through creates_shortage (design §6.4). */
export function adjustStock(
  state: InventoryState,
  input: { articleId: string; delta: number; reason: string; acceptShortage?: boolean; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "adjustment", input, ctx, () => {
    if (!can(ctx.actor, "stock.adjust")) return fail("forbidden");
    const article = findArticle(state, input.articleId);
    if (!article) return fail("not_found");
    if (!Number.isInteger(input.delta) || input.delta === 0) return fail("invalid_quantity", { field: "delta" });
    if (!hasText(input.reason)) return fail("reason_required", { field: "reason" });
    const level = stockOf(state, article.id);
    if (input.delta < 0 && level.available < -input.delta) return fail("insufficient_stock");

    const next = cloneState(state);
    const header = movementHeader(next, "adjustment", ctx);
    const quantity = Math.abs(input.delta);
    appendMovement(next, {
      ...header,
      reason: input.reason.trim(),
      acceptShortage: input.acceptShortage ? true : undefined,
      lines: [
        input.delta > 0
          ? { lineNo: 1, articleId: article.id, quantity, from: "adjustment", to: "available" }
          : { lineNo: 1, articleId: article.id, quantity, from: "available", to: "adjustment" },
      ],
    });
    next.stock[article.id] = { ...level, available: level.available + input.delta };

    if (input.delta < 0 && !input.acceptShortage) {
      const now = ctx.clock.now();
      const before = conflictFor(state, article.id, now)?.shortage ?? 0;
      const after = conflictFor(next, article.id, now);
      if (after && after.shortage > before) {
        return fail("creates_shortage", {
          affectedEvents: after.affectedEventIds.map((eventId) => ({ eventId, articleId: article.id, missing: after.shortage })),
        });
      }
    }
    return succeed(next, { movementId: header.id });
  });
}

/** Releasing washing returns units to available (R6). */
export function releaseWashing(
  state: InventoryState,
  input: { batchId: string; quantity: number; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "washing_release", input, ctx, () => {
    if (!can(ctx.actor, "warehouse.operate")) return fail("forbidden");
    const batch = state.batches.find((b) => b.id === input.batchId);
    if (!batch) return fail("not_found");
    if (!isPositiveInteger(input.quantity)) return fail("invalid_quantity", { field: "quantity" });
    if (input.quantity > batch.quantity - batch.releasedQty - batch.removedQty) return fail("batch_exceeded");

    const next = cloneState(state);
    const header = movementHeader(next, "washing_release", ctx);
    appendMovement(next, {
      ...header,
      eventId: batch.eventId,
      lines: [{ lineNo: 1, articleId: batch.articleId, quantity: input.quantity, from: "washing", to: "available", washingBatchId: batch.id }],
    });
    const nextBatch = next.batches.find((b) => b.id === batch.id)!;
    nextBatch.releasedQty += input.quantity;
    const level = stockOf(next, batch.articleId);
    next.stock[batch.articleId] = { ...level, washing: level.washing - input.quantity, available: level.available + input.quantity };
    return succeed(next, { movementId: header.id });
  });
}

/** Breakage or loss discovered while washing; the batch knows which event it came from. */
export function registerWashingLoss(
  state: InventoryState,
  input: { batchId: string; quantity: number; outcome: "broken" | "lost"; reason: string; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ movementId: string }> {
  return withIdempotency(state, input.idempotencyKey, "washing_loss", input, ctx, () => {
    if (!can(ctx.actor, "warehouse.operate")) return fail("forbidden");
    const batch = state.batches.find((b) => b.id === input.batchId);
    if (!batch) return fail("not_found");
    if (!isPositiveInteger(input.quantity)) return fail("invalid_quantity", { field: "quantity" });
    if (!hasText(input.reason)) return fail("reason_required", { field: "reason" });
    if (input.outcome !== "broken" && input.outcome !== "lost") return fail("validation", { field: "outcome" });
    if (input.quantity > batch.quantity - batch.releasedQty - batch.removedQty) return fail("batch_exceeded");

    const next = cloneState(state);
    const header = movementHeader(next, "washing_loss", ctx);
    appendMovement(next, {
      ...header,
      eventId: batch.eventId,
      reason: input.reason.trim(),
      lines: [
        {
          lineNo: 1,
          articleId: batch.articleId,
          quantity: input.quantity,
          from: "washing",
          to: input.outcome,
          washingBatchId: batch.id,
          reason: input.reason.trim(),
        },
      ],
    });
    next.batches.find((b) => b.id === batch.id)!.removedQty += input.quantity;
    const level = stockOf(next, batch.articleId);
    next.stock[batch.articleId] = { ...level, washing: level.washing - input.quantity };
    return succeed(next, { movementId: header.id });
  });
}

export { movementHeader };
