import { availabilityFor } from "./availability";
import { fail, succeed, type CloseBlocker, type CommandResult, type ShortageLine } from "./errors";
import { withIdempotency } from "./idempotency";
import { can } from "./permissions";
import {
  cloneState,
  findArticle,
  findEvent,
  hasText,
  isActiveStatus,
  isPositiveInteger,
  nextId,
  pendingReturn,
  resolvedQty,
  toDispatch,
  windowEnd,
} from "./state";
import type { CateringEvent, CommandContext, InventoryState, ReservationLine } from "./types";

export interface DraftLineInput {
  articleId: string;
  quantity: number;
}

export interface DraftInput {
  name: string;
  customer: string;
  venue: string;
  departureAt: number;
  readyAt: number;
  lines?: DraftLineInput[];
}

function newLine(state: InventoryState, event: Pick<CateringEvent, "departureAt">, input: DraftLineInput): ReservationLine {
  return {
    id: nextId(state, "lin"),
    articleId: input.articleId,
    requestedQty: input.quantity,
    committedQty: 0,
    releasedQty: 0,
    dispatchedQty: 0,
    returnedGoodQty: 0,
    returnedWashingQty: 0,
    brokenQty: 0,
    lostQty: 0,
    windowStart: event.departureAt,
  };
}

function checkVersion(event: CateringEvent, expectedVersion: number | undefined) {
  if (expectedVersion !== undefined && expectedVersion !== event.version) return fail("stale_version");
  return null;
}

function validateDetails(input: Partial<DraftInput>) {
  if (input.name !== undefined && !hasText(input.name)) return fail("validation", { field: "name" });
  if (input.customer !== undefined && !hasText(input.customer)) return fail("validation", { field: "customer" });
  if (input.venue !== undefined && !hasText(input.venue)) return fail("validation", { field: "venue" });
  return null;
}

function validateDates(departureAt: number, readyAt: number) {
  if (!Number.isFinite(departureAt) || !Number.isFinite(readyAt)) return fail("invalid_dates", { field: "departureAt" });
  if (readyAt <= departureAt) return fail("invalid_dates", { field: "readyAt" });
  return null;
}

function validateLines(state: InventoryState, lines: DraftLineInput[]) {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!findArticle(state, line.articleId)) return fail("not_found", { field: "articleId" });
    if (!isPositiveInteger(line.quantity)) return fail("invalid_quantity", { field: "quantity" });
    if (seen.has(line.articleId)) return fail("duplicate_line", { field: "articleId" });
    seen.add(line.articleId);
  }
  return null;
}

/** A draft simulates quantities and commits nothing (R1). */
export function createDraft(state: InventoryState, input: DraftInput, ctx: CommandContext): CommandResult<{ eventId: string }> {
  if (!can(ctx.actor, "event.edit")) return fail("forbidden");
  const invalid =
    validateDetails({ name: input.name ?? "", customer: input.customer ?? "", venue: input.venue ?? "" }) ??
    validateDates(input.departureAt, input.readyAt) ??
    validateLines(state, input.lines ?? []);
  if (invalid) return invalid;

  const next = cloneState(state);
  const eventId = nextId(next, "evt");
  const event: CateringEvent = {
    id: eventId,
    name: input.name.trim(),
    customer: input.customer.trim(),
    venue: input.venue.trim(),
    departureAt: input.departureAt,
    readyAt: input.readyAt,
    status: "draft",
    version: 1,
    lines: [],
    createdAt: ctx.clock.now(),
    createdBy: ctx.actor.id,
  };
  event.lines = (input.lines ?? []).map((line) => newLine(next, event, line));
  next.events.push(event);
  return succeed(next, { eventId });
}

export function updateDraft(
  state: InventoryState,
  input: { eventId: string; expectedVersion?: number } & Partial<Omit<DraftInput, "lines">>,
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  if (!can(ctx.actor, "event.edit")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  if (event.status !== "draft") return fail("invalid_state");
  const invalid =
    checkVersion(event, input.expectedVersion) ??
    validateDetails(input) ??
    validateDates(input.departureAt ?? event.departureAt, input.readyAt ?? event.readyAt);
  if (invalid) return invalid;

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  if (input.name !== undefined) target.name = input.name.trim();
  if (input.customer !== undefined) target.customer = input.customer.trim();
  if (input.venue !== undefined) target.venue = input.venue.trim();
  if (input.departureAt !== undefined) target.departureAt = input.departureAt;
  if (input.readyAt !== undefined) target.readyAt = input.readyAt;
  for (const line of target.lines) line.windowStart = target.departureAt;
  target.version += 1;
  return succeed(next, { version: target.version });
}

/**
 * Adds or changes a line. In a draft it only simulates; on a confirmed event an increase
 * is validated again (R4) and a decrease cannot go below what was dispatched or released.
 */
export function setLineQuantity(
  state: InventoryState,
  input: { eventId: string; articleId: string; quantity: number; expectedVersion?: number },
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  if (!can(ctx.actor, "event.edit")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  const article = findArticle(state, input.articleId);
  if (!article) return fail("not_found", { field: "articleId" });
  if (!isPositiveInteger(input.quantity)) return fail("invalid_quantity", { field: "quantity" });
  const stale = checkVersion(event, input.expectedVersion);
  if (stale) return stale;

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  const existing = target.lines.find((line) => line.articleId === article.id);

  if (event.status === "draft") {
    if (existing) existing.requestedQty = input.quantity;
    else target.lines.push(newLine(next, target, { articleId: article.id, quantity: input.quantity }));
    target.version += 1;
    return succeed(next, { version: target.version });
  }

  if (!isActiveStatus(event.status)) return fail("invalid_state");
  const line = existing ?? newLine(next, target, { articleId: article.id, quantity: input.quantity });
  const floor = line.dispatchedQty + line.releasedQty;
  if (input.quantity < floor) return fail("invalid_quantity", { field: "quantity" });

  if (input.quantity > line.committedQty) {
    const now = ctx.clock.now();
    const window = { from: line.windowStart, to: windowEnd(event, article.kind) };
    const free = Math.max(0, availabilityFor(state, article.id, window, now, { excludeEventId: event.id }).available);
    const alreadySettled = line.releasedQty + resolvedQty(line, article.kind);
    const neededOpen = input.quantity - alreadySettled;
    if (neededOpen > free) {
      const available = free + alreadySettled;
      return fail("shortage", {
        shortages: [{ lineId: line.id, articleId: article.id, requested: input.quantity, available, missing: input.quantity - available }],
      });
    }
  }
  line.requestedQty = input.quantity;
  line.committedQty = input.quantity;
  if (!existing) target.lines.push(line);
  target.version += 1;
  return succeed(next, { version: target.version });
}

export function removeLine(
  state: InventoryState,
  input: { eventId: string; articleId: string; expectedVersion?: number },
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  if (!can(ctx.actor, "event.edit")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  if (event.status !== "draft") return fail("invalid_state");
  const stale = checkVersion(event, input.expectedVersion);
  if (stale) return stale;
  if (!event.lines.some((line) => line.articleId === input.articleId)) return fail("not_found", { field: "articleId" });

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  target.lines = target.lines.filter((line) => line.articleId !== input.articleId);
  target.version += 1;
  return succeed(next, { version: target.version });
}

/**
 * Validates every line together (R3). If any line is short the draft stays intact and the
 * error lists requested, available and missing per line. The calculation that counts is the
 * one made at confirmation time, even if the screen showed availability a second earlier.
 */
export function confirmEvent(
  state: InventoryState,
  input: { eventId: string; expectedVersion?: number; idempotencyKey?: string },
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  return withIdempotency(state, input.idempotencyKey, "confirm", input, ctx, () => {
    if (!can(ctx.actor, "event.lifecycle")) return fail("forbidden");
    const event = findEvent(state, input.eventId);
    if (!event) return fail("not_found");
    if (event.status !== "draft") return fail("invalid_state");
    const stale = checkVersion(event, input.expectedVersion);
    if (stale) return stale;
    if (event.lines.length === 0) return fail("validation", { field: "lines" });
    const now = ctx.clock.now();
    if (event.readyAt <= now) return fail("invalid_dates", { field: "readyAt" });

    const shortages: ShortageLine[] = [];
    for (const line of event.lines) {
      const article = findArticle(state, line.articleId)!;
      const window = { from: event.departureAt, to: windowEnd(event, article.kind) };
      const free = Math.max(0, availabilityFor(state, article.id, window, now, { excludeEventId: event.id }).available);
      if (line.requestedQty > free) {
        shortages.push({ lineId: line.id, articleId: article.id, requested: line.requestedQty, available: free, missing: line.requestedQty - free });
      }
    }
    if (shortages.length > 0) return fail("shortage", { shortages });

    const next = cloneState(state);
    const target = findEvent(next, event.id)!;
    for (const line of target.lines) {
      line.committedQty = line.requestedQty;
      line.windowStart = target.departureAt;
    }
    target.status = "confirmed";
    target.confirmedAt = now;
    target.confirmedBy = ctx.actor.id;
    target.version += 1;
    return succeed(next, { version: target.version });
  });
}

/** Cancelling before dispatch frees the whole reservation (R8). With dispatches, release and close instead. */
export function cancelEvent(
  state: InventoryState,
  input: { eventId: string; expectedVersion?: number },
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  if (!can(ctx.actor, "event.lifecycle")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  if (event.status !== "draft" && event.status !== "confirmed") {
    return event.status === "in_progress" ? fail("cancel_blocked") : fail("invalid_state");
  }
  if (event.lines.some((line) => line.dispatchedQty > 0)) return fail("cancel_blocked");
  const stale = checkVersion(event, input.expectedVersion);
  if (stale) return stale;

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  target.status = "cancelled";
  target.cancelledAt = ctx.clock.now();
  target.version += 1;
  return succeed(next, { version: target.version });
}

/** Releases the undispatched balance of every line (R4). */
export function releaseRemaining(
  state: InventoryState,
  input: { eventId: string; expectedVersion?: number },
  ctx: CommandContext,
): CommandResult<{ released: number; version: number }> {
  if (!can(ctx.actor, "event.lifecycle")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  if (!isActiveStatus(event.status)) return fail("invalid_state");
  const stale = checkVersion(event, input.expectedVersion);
  if (stale) return stale;
  const released = event.lines.reduce((sum, line) => sum + toDispatch(line), 0);
  if (released === 0) return fail("nothing_to_register");

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  for (const line of target.lines) line.releasedQty += toDispatch(line);
  target.version += 1;
  return succeed(next, { released, version: target.version });
}

export function closeBlockers(state: InventoryState, event: CateringEvent): CloseBlocker[] {
  const blockers: CloseBlocker[] = [];
  for (const line of event.lines) {
    const article = findArticle(state, line.articleId)!;
    const pending = pendingReturn(line, article.kind);
    const remaining = toDispatch(line);
    if (pending > 0 || remaining > 0) {
      blockers.push({ lineId: line.id, articleId: line.articleId, toDispatch: remaining, pendingReturn: pending });
    }
  }
  return blockers;
}

/** Closing needs every line dispatched or released and zero pending return (R9). Washing continues. */
export function closeEvent(
  state: InventoryState,
  input: { eventId: string; note?: string; expectedVersion?: number },
  ctx: CommandContext,
): CommandResult<{ version: number }> {
  if (!can(ctx.actor, "event.lifecycle")) return fail("forbidden");
  const event = findEvent(state, input.eventId);
  if (!event) return fail("not_found");
  if (!isActiveStatus(event.status)) return fail("invalid_state");
  const stale = checkVersion(event, input.expectedVersion);
  if (stale) return stale;
  const blockers = closeBlockers(state, event);
  if (blockers.length > 0) return fail("close_blocked", { closeBlockers: blockers });

  const next = cloneState(state);
  const target = findEvent(next, event.id)!;
  target.status = "closed";
  target.closedAt = ctx.clock.now();
  if (hasText(input.note)) target.closeNote = input.note.trim();
  target.version += 1;
  return succeed(next, { version: target.version });
}

