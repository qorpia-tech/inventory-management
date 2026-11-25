import { availabilityFor, commitmentSegments, findConflicts } from "./availability";
import type { CloseBlocker } from "./errors";
import { closeBlockers } from "./events";
import {
  findArticle,
  findEvent,
  isActiveStatus,
  openCommitment,
  pendingReturn,
  physicalQty,
  stockOf,
  toDispatch,
  windowEnd,
} from "./state";
import type { ArticleKind, Bucket, EventStatus, InventoryState, MovementKind, WashingPurpose } from "./types";

export interface LedgerEntry {
  movementId: string;
  lineNo: number;
  kind: MovementKind;
  occurredAt: number;
  recordedBy: { id: string; name: string };
  articleId: string;
  articleName: string;
  quantity: number;
  from: Bucket;
  to: Bucket;
  reason?: string;
  eventId?: string;
  eventName?: string;
  locationName: string;
  washingBatchId?: string;
  acceptShortage?: boolean;
}

export interface WashingBatchView {
  id: string;
  articleId: string;
  articleName: string;
  eventId?: string;
  eventName?: string;
  sourceMovementId: string;
  purpose: WashingPurpose;
  quantity: number;
  released: number;
  removed: number;
  remaining: number;
  createdAt: number;
}

export type Alert =
  | { kind: "overdue"; eventId: string; eventName: string; articleId: string; articleName: string; quantity: number; dueAt: number }
  | { kind: "expired"; eventId: string; eventName: string; articleId: string; articleName: string; quantity: number; dueAt: number }
  | {
      kind: "conflict";
      articleId: string;
      articleName: string;
      shortage: number;
      at: number;
      affectedEventIds: string[];
      affectedEventNames: string[];
    };

export interface EventLineView {
  lineId: string;
  articleId: string;
  articleName: string;
  articleSku: string;
  articleKind: ArticleKind;
  requested: number;
  committed: number;
  released: number;
  dispatched: number;
  returnedGood: number;
  returnedWashing: number;
  broken: number;
  lost: number;
  toDispatch: number;
  pendingReturn: number;
  openCommitment: number;
  /** What this event could hold for the article: availability excluding its own lines. */
  available: number;
  /** Draft only: requested − available, never negative. */
  missing: number;
  /** What another event in this same window would find. */
  freeForOthers: number;
  /** Demand of other drafts overlapping this window (information only, design §6.9). */
  otherDraftsDemand: number;
  /** Units on the shelf right now. */
  stockAvailable: number;
  windowStart: number;
  windowEnd: number;
}

export interface EventView {
  id: string;
  name: string;
  customer: string;
  venue: string;
  departureAt: number;
  readyAt: number;
  status: EventStatus;
  version: number;
  closeNote?: string;
  createdAt: number;
  confirmedAt?: number;
  closedAt?: number;
  lines: EventLineView[];
  totals: { requested: number; committed: number; out: number; pendingReturn: number; toDispatch: number; consumed: number };
  canConfirm: boolean;
  canCancel: boolean;
  canClose: boolean;
  canRelease: boolean;
  closeBlockers: CloseBlocker[];
  alerts: Alert[];
  washingBatches: WashingBatchView[];
  movements: LedgerEntry[];
}

export interface AgendaItem {
  id: string;
  name: string;
  customer: string;
  venue: string;
  departureAt: number;
  readyAt: number;
  status: EventStatus;
  lineCount: number;
  shortLines: number;
  out: number;
  pendingReturn: number;
  toDispatch: number;
  alertCount: number;
}

export interface StockRow {
  articleId: string;
  sku: string;
  name: string;
  category: string;
  kind: ArticleKind;
  available: number;
  washing: number;
  out: number;
  physical: number;
  /** Open commitments of confirmed events that have not ended yet. */
  reservedUpcoming: number;
  hasMovements: boolean;
}

export interface ArticleView extends StockRow {
  createdAt: number;
  batches: WashingBatchView[];
  commitments: { eventId: string; eventName: string; status: EventStatus; from: number; to: number; quantity: number }[];
  movements: LedgerEntry[];
}

export function listLedger(state: InventoryState, filter: { articleId?: string; eventId?: string } = {}): LedgerEntry[] {
  const entries: { entry: LedgerEntry; order: number }[] = [];
  state.movements.forEach((movement, index) => {
    if (filter.eventId && movement.eventId !== filter.eventId) return;
    const event = movement.eventId ? findEvent(state, movement.eventId) : undefined;
    for (const line of movement.lines) {
      if (filter.articleId && line.articleId !== filter.articleId) continue;
      entries.push({
        order: index * 1000 + line.lineNo,
        entry: {
          movementId: movement.id,
          lineNo: line.lineNo,
          kind: movement.kind,
          occurredAt: movement.occurredAt,
          recordedBy: movement.recordedBy,
          articleId: line.articleId,
          articleName: findArticle(state, line.articleId)?.name ?? line.articleId,
          quantity: line.quantity,
          from: line.from,
          to: line.to,
          reason: line.reason ?? movement.reason,
          eventId: movement.eventId,
          eventName: event?.name,
          locationName: state.locationName,
          washingBatchId: line.washingBatchId,
          acceptShortage: movement.acceptShortage,
        },
      });
    }
  });
  return entries
    .sort((a, b) => b.entry.occurredAt - a.entry.occurredAt || b.order - a.order)
    .map(({ entry }) => entry);
}

export function listWashingBatches(state: InventoryState, filter: { eventId?: string; articleId?: string; includeEmpty?: boolean } = {}): WashingBatchView[] {
  return state.batches
    .filter((batch) => (!filter.eventId || batch.eventId === filter.eventId) && (!filter.articleId || batch.articleId === filter.articleId))
    .map((batch) => ({
      id: batch.id,
      articleId: batch.articleId,
      articleName: findArticle(state, batch.articleId)?.name ?? batch.articleId,
      eventId: batch.eventId,
      eventName: batch.eventId ? findEvent(state, batch.eventId)?.name : undefined,
      sourceMovementId: batch.sourceMovementId,
      purpose: batch.purpose,
      quantity: batch.quantity,
      released: batch.releasedQty,
      removed: batch.removedQty,
      remaining: batch.quantity - batch.releasedQty - batch.removedQty,
      createdAt: batch.createdAt,
    }))
    .filter((batch) => filter.includeEmpty || batch.remaining > 0)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function listAlerts(state: InventoryState, now: number): Alert[] {
  const alerts: Alert[] = [];
  for (const event of [...state.events].sort((a, b) => a.departureAt - b.departureAt)) {
    if (event.status === "cancelled" || event.status === "draft") continue;
    for (const line of event.lines) {
      const article = findArticle(state, line.articleId)!;
      const pending = pendingReturn(line, article.kind);
      if (article.kind === "returnable" && pending > 0 && event.readyAt <= now) {
        alerts.push({ kind: "overdue", eventId: event.id, eventName: event.name, articleId: article.id, articleName: article.name, quantity: pending, dueAt: event.readyAt });
      }
      const remaining = toDispatch(line);
      if (isActiveStatus(event.status) && remaining > 0 && windowEnd(event, article.kind) <= now) {
        alerts.push({ kind: "expired", eventId: event.id, eventName: event.name, articleId: article.id, articleName: article.name, quantity: remaining, dueAt: event.readyAt });
      }
    }
  }
  for (const conflict of findConflicts(state, now)) {
    alerts.push({
      kind: "conflict",
      articleId: conflict.articleId,
      articleName: findArticle(state, conflict.articleId)?.name ?? conflict.articleId,
      shortage: conflict.shortage,
      at: conflict.at,
      affectedEventIds: conflict.affectedEventIds,
      affectedEventNames: conflict.affectedEventIds.map((id) => findEvent(state, id)?.name ?? id),
    });
  }
  return alerts;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function getEventView(state: InventoryState, eventId: string, now: number): EventView | null {
  const event = findEvent(state, eventId);
  if (!event) return null;
  const isDraft = event.status === "draft";
  const lines: EventLineView[] = event.lines.map((line) => {
    const article = findArticle(state, line.articleId)!;
    const start = isDraft ? event.departureAt : line.windowStart;
    const end = windowEnd(event, article.kind);
    const window = { from: start, to: end };
    const available = availabilityFor(state, article.id, window, now, { excludeEventId: event.id }).available;
    const freeForOthers = Math.max(0, availabilityFor(state, article.id, window, now).available);
    const otherDraftsDemand = state.events
      .filter((other) => other.id !== event.id && other.status === "draft" && overlaps(other.departureAt, windowEnd(other, article.kind), start, end))
      .flatMap((other) => other.lines.filter((l) => l.articleId === article.id))
      .reduce((sum, l) => sum + l.requestedQty, 0);
    return {
      lineId: line.id,
      articleId: article.id,
      articleName: article.name,
      articleSku: article.sku,
      articleKind: article.kind,
      requested: line.requestedQty,
      committed: line.committedQty,
      released: line.releasedQty,
      dispatched: line.dispatchedQty,
      returnedGood: line.returnedGoodQty,
      returnedWashing: line.returnedWashingQty,
      broken: line.brokenQty,
      lost: line.lostQty,
      toDispatch: toDispatch(line),
      pendingReturn: pendingReturn(line, article.kind),
      openCommitment: isActiveStatus(event.status) ? openCommitment(line, article.kind) : 0,
      available,
      missing: isDraft ? Math.max(0, line.requestedQty - Math.max(0, available)) : 0,
      freeForOthers,
      otherDraftsDemand,
      stockAvailable: stockOf(state, article.id).available,
      windowStart: start,
      windowEnd: end,
    };
  });
  const blockers = closeBlockers(state, event);
  const alerts = listAlerts(state, now).filter((alert) =>
    alert.kind === "conflict" ? alert.affectedEventIds.includes(event.id) : alert.eventId === event.id,
  );
  return {
    id: event.id,
    name: event.name,
    customer: event.customer,
    venue: event.venue,
    departureAt: event.departureAt,
    readyAt: event.readyAt,
    status: event.status,
    version: event.version,
    closeNote: event.closeNote,
    createdAt: event.createdAt,
    confirmedAt: event.confirmedAt,
    closedAt: event.closedAt,
    lines,
    totals: {
      requested: lines.reduce((sum, l) => sum + l.requested, 0),
      committed: lines.reduce((sum, l) => sum + l.committed, 0),
      out: lines.reduce((sum, l) => sum + l.pendingReturn, 0),
      pendingReturn: lines.reduce((sum, l) => sum + l.pendingReturn, 0),
      toDispatch: lines.reduce((sum, l) => sum + l.toDispatch, 0),
      consumed: lines.filter((l) => l.articleKind === "consumable").reduce((sum, l) => sum + l.dispatched, 0),
    },
    canConfirm: isDraft && lines.length > 0,
    canCancel: (isDraft || event.status === "confirmed") && lines.every((l) => l.dispatched === 0),
    canClose: isActiveStatus(event.status) && lines.length > 0 && blockers.length === 0,
    canRelease: isActiveStatus(event.status) && lines.some((l) => l.toDispatch > 0),
    closeBlockers: blockers,
    alerts,
    washingBatches: listWashingBatches(state, { eventId: event.id, includeEmpty: true }),
    movements: listLedger(state, { eventId: event.id }),
  };
}

export function listAgenda(state: InventoryState, now: number): AgendaItem[] {
  const alerts = listAlerts(state, now);
  return [...state.events]
    .sort((a, b) => a.departureAt - b.departureAt)
    .map((event) => {
      const view = getEventView(state, event.id, now)!;
      return {
        id: event.id,
        name: event.name,
        customer: event.customer,
        venue: event.venue,
        departureAt: event.departureAt,
        readyAt: event.readyAt,
        status: event.status,
        lineCount: event.lines.length,
        shortLines: view.lines.filter((l) => l.missing > 0).length,
        out: view.totals.out,
        pendingReturn: view.totals.pendingReturn,
        toDispatch: view.totals.toDispatch,
        alertCount: alerts.filter((a) => (a.kind === "conflict" ? a.affectedEventIds.includes(event.id) : a.eventId === event.id)).length,
      };
    });
}

function stockRow(state: InventoryState, articleId: string, now: number): StockRow {
  const article = findArticle(state, articleId)!;
  const level = stockOf(state, article.id);
  const reservedUpcoming = commitmentSegments(state, article.id)
    .filter((segment) => segment.end > now)
    .reduce((sum, segment) => sum + segment.quantity, 0);
  return {
    articleId: article.id,
    sku: article.sku,
    name: article.name,
    category: article.category,
    kind: article.kind,
    available: level.available,
    washing: level.washing,
    out: level.out,
    physical: physicalQty(level),
    reservedUpcoming,
    hasMovements: state.movements.some((m) => m.lines.some((l) => l.articleId === article.id)),
  };
}

export function getStockOverview(state: InventoryState, now: number): StockRow[] {
  return [...state.articles]
    .sort((a, b) => a.category.localeCompare(b.category, "es") || a.name.localeCompare(b.name, "es"))
    .map((article) => stockRow(state, article.id, now));
}

export function getArticleView(state: InventoryState, articleId: string, now: number): ArticleView | null {
  const article = findArticle(state, articleId);
  if (!article) return null;
  const commitments = state.events
    .filter((event) => isActiveStatus(event.status))
    .flatMap((event) =>
      event.lines
        .filter((line) => line.articleId === article.id)
        .map((line) => ({
          eventId: event.id,
          eventName: event.name,
          status: event.status,
          from: line.windowStart,
          to: windowEnd(event, article.kind),
          quantity: openCommitment(line, article.kind),
        })),
    )
    .filter((c) => c.quantity > 0 && c.to > now)
    .sort((a, b) => a.from - b.from);
  return {
    ...stockRow(state, article.id, now),
    createdAt: article.createdAt,
    batches: listWashingBatches(state, { articleId: article.id }),
    commitments,
    movements: listLedger(state, { articleId: article.id }),
  };
}
