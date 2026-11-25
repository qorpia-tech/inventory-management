import { findArticle, isActiveStatus, openCommitment, pendingReturn, physicalQty, stockOf, windowEnd } from "./state";
import type { InventoryState } from "./types";

export interface CommitmentSegment {
  /** Inclusive start. */
  start: number;
  /** Exclusive end; Infinity for consumables. */
  end: number;
  quantity: number;
  eventId?: string;
  lineId?: string;
}

export interface TimeWindow {
  from: number;
  to: number;
}

export interface AvailabilityBreakdown {
  physical: number;
  washing: number;
  overdue: number;
  peak: number;
  available: number;
}

interface SweepPoint {
  at: number;
  delta: number;
}

function comparePoints(a: SweepPoint, b: SweepPoint): number {
  if (a.at === b.at) return a.delta - b.delta; // ends (negative) before starts: the end instant is free again (R2)
  return a.at < b.at ? -1 : 1;
}

function sweepPoints(segments: readonly CommitmentSegment[], from: number, to: number): SweepPoint[] {
  const points: SweepPoint[] = [];
  for (const segment of segments) {
    if (segment.quantity <= 0) continue;
    const start = Math.max(segment.start, from);
    const end = Math.min(segment.end, to);
    if (start < end) {
      points.push({ at: start, delta: segment.quantity }, { at: end, delta: -segment.quantity });
    }
  }
  return points.sort(comparePoints);
}

/**
 * Maximum, at any instant of [from, to), of the overlapping commitments (design §5.3).
 * Windows are half-open, so two back-to-back reservations can reuse the same units.
 */
export function peakCommitment(segments: readonly CommitmentSegment[], from: number, to: number): number {
  if (!(from < to)) return 0;
  let running = 0;
  let peak = 0;
  for (const point of sweepPoints(segments, from, to)) {
    running += point.delta;
    if (running > peak) peak = running;
  }
  return peak;
}

/** Open commitments of active lines (confirmed or in progress) for one article. */
export function commitmentSegments(
  state: InventoryState,
  articleId: string,
  options: { excludeEventId?: string } = {},
): CommitmentSegment[] {
  const article = findArticle(state, articleId);
  if (!article) return [];
  const segments: CommitmentSegment[] = [];
  for (const event of state.events) {
    if (!isActiveStatus(event.status) || event.id === options.excludeEventId) continue;
    for (const line of event.lines) {
      if (line.articleId !== articleId) continue;
      const quantity = openCommitment(line, article.kind);
      if (quantity > 0) {
        segments.push({ start: line.windowStart, end: windowEnd(event, article.kind), quantity, eventId: event.id, lineId: line.id });
      }
    }
  }
  return segments;
}

/** Pending return of returnable lines whose window already ended (R6). */
export function overdueQty(state: InventoryState, articleId: string, now: number): number {
  const article = findArticle(state, articleId);
  if (!article || article.kind === "consumable") return 0;
  let total = 0;
  for (const event of state.events) {
    if (event.readyAt > now) continue;
    for (const line of event.lines) {
      if (line.articleId === articleId) total += Math.max(0, pendingReturn(line, article.kind));
    }
  }
  return total;
}

/** Units that can be committed regardless of time: physical − washing − overdue. */
export function baseCapacity(state: InventoryState, articleId: string, now: number): number {
  const level = stockOf(state, articleId);
  return physicalQty(level) - level.washing - overdueQty(state, articleId, now);
}

/**
 * disponible(W) = física − en_lavado − atrasado − pico(W) (design §5.1).
 * W is clipped to start now, so an overdue line is never counted twice.
 */
export function availabilityFor(
  state: InventoryState,
  articleId: string,
  window: TimeWindow,
  now: number,
  options: { excludeEventId?: string } = {},
): AvailabilityBreakdown {
  const level = stockOf(state, articleId);
  const physical = physicalQty(level);
  const overdue = overdueQty(state, articleId, now);
  const from = Math.max(window.from, now);
  const peak = peakCommitment(commitmentSegments(state, articleId, options), from, window.to);
  return { physical, washing: level.washing, overdue, peak, available: physical - level.washing - overdue - peak };
}

export interface ConflictPoint {
  articleId: string;
  /** Worst future instant. */
  at: number;
  shortage: number;
  affectedEventIds: string[];
}

/** Future instant where availability is most negative for an article, if any (design §6.5). */
export function conflictFor(state: InventoryState, articleId: string, now: number, window?: TimeWindow): ConflictPoint | null {
  const base = baseCapacity(state, articleId, now);
  const segments = commitmentSegments(state, articleId);
  const from = Math.max(window?.from ?? now, now);
  const to = window?.to ?? Number.POSITIVE_INFINITY;
  if (!(from < to)) return null;
  let running = 0;
  let worst = 0;
  let worstAt = from;
  for (const point of sweepPoints(segments, from, to)) {
    running += point.delta;
    if (running > worst) {
      worst = running;
      worstAt = point.at;
    }
  }
  const shortage = worst - base;
  if (shortage <= 0) return null;
  const affectedEventIds = [
    ...new Set(segments.filter((s) => s.start <= worstAt && worstAt < s.end && s.eventId).map((s) => s.eventId as string)),
  ];
  return { articleId, at: worstAt, shortage, affectedEventIds };
}

export function findConflicts(state: InventoryState, now: number): ConflictPoint[] {
  return state.articles
    .map((article) => conflictFor(state, article.id, now))
    .filter((conflict): conflict is ConflictPoint => conflict !== null);
}
