import type { Article, CateringEvent, InventoryState, Movement, ReservationLine, StockLevel } from "./types";

export function createEmptyState(input: { companyId: string; locationId: string; locationName: string }): InventoryState {
  return {
    schemaVersion: 1,
    companyId: input.companyId,
    locationId: input.locationId,
    locationName: input.locationName,
    articles: [],
    stock: {},
    batches: [],
    events: [],
    movements: [],
    idempotency: {},
    sequence: 0,
  };
}

/** Commands work on a copy, so a rejected command leaves the original untouched. */
export function cloneState(state: InventoryState): InventoryState {
  return structuredClone(state);
}

export function nextId(state: InventoryState, prefix: string): string {
  state.sequence += 1;
  return `${prefix}-${state.sequence.toString(36).padStart(4, "0")}`;
}

export function findArticle(state: InventoryState, articleId: string): Article | undefined {
  return state.articles.find((article) => article.id === articleId);
}

export function findEvent(state: InventoryState, eventId: string): CateringEvent | undefined {
  return state.events.find((event) => event.id === eventId);
}

export function stockOf(state: InventoryState, articleId: string): StockLevel {
  return state.stock[articleId] ?? { available: 0, washing: 0, out: 0 };
}

export function physicalQty(level: StockLevel): number {
  return level.available + level.washing + level.out;
}

export function resolvedQty(line: ReservationLine, kind: Article["kind"]): number {
  if (kind === "consumable") return line.dispatchedQty;
  return line.returnedGoodQty + line.returnedWashingQty + line.brokenQty + line.lostQty;
}

/** Open commitment = committed − released − resolved (design §5.2). */
export function openCommitment(line: ReservationLine, kind: Article["kind"]): number {
  return Math.max(0, line.committedQty - line.releasedQty - resolvedQty(line, kind));
}

/** Units dispatched and not yet received back. Zero for consumables by definition. */
export function pendingReturn(line: ReservationLine, kind: Article["kind"]): number {
  if (kind === "consumable") return 0;
  return line.dispatchedQty - resolvedQty(line, kind);
}

export function toDispatch(line: ReservationLine): number {
  return Math.max(0, line.committedQty - line.releasedQty - line.dispatchedQty);
}

/** End of the commitment window: ready time, or open ended for consumables. */
export function windowEnd(event: CateringEvent, kind: Article["kind"]): number {
  return kind === "consumable" ? Number.POSITIVE_INFINITY : event.readyAt;
}

export function isActiveStatus(status: CateringEvent["status"]): boolean {
  return status === "confirmed" || status === "in_progress";
}

export function appendMovement(state: InventoryState, movement: Movement): void {
  state.movements.push(movement);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
