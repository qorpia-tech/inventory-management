import type { InventoryState } from "./types";

export type DomainErrorCode =
  | "forbidden"
  | "not_found"
  | "validation"
  | "invalid_quantity"
  | "reason_required"
  | "invalid_dates"
  | "invalid_state"
  | "stale_version"
  | "duplicate_sku"
  | "duplicate_line"
  | "opening_exists"
  | "shortage"
  | "over_dispatch"
  | "insufficient_stock"
  | "insufficient_availability"
  | "reservation_expired"
  | "unresolved_conflict"
  | "over_receipt"
  | "consumable_return"
  | "nothing_to_register"
  | "close_blocked"
  | "cancel_blocked"
  | "batch_exceeded"
  | "creates_shortage"
  | "idempotency_mismatch";

/** Per line detail when availability does not cover a request (R3). */
export interface ShortageLine {
  lineId?: string;
  articleId: string;
  requested: number;
  available: number;
  missing: number;
}

export interface OverReceiptLine {
  lineId: string;
  articleId: string;
  pending: number;
  attempted: number;
}

export interface CloseBlocker {
  lineId: string;
  articleId: string;
  toDispatch: number;
  pendingReturn: number;
}

export interface AffectedEvent {
  eventId: string;
  articleId: string;
  missing: number;
}

export interface DomainError {
  code: DomainErrorCode;
  field?: string;
  shortages?: ShortageLine[];
  overReceipts?: OverReceiptLine[];
  closeBlockers?: CloseBlocker[];
  affectedEvents?: AffectedEvent[];
}

export type CommandResult<T> =
  | { ok: true; state: InventoryState; value: T; replayed?: boolean }
  | { ok: false; error: DomainError };

export function fail(code: DomainErrorCode, extra: Omit<DomainError, "code"> = {}): { ok: false; error: DomainError } {
  return { ok: false, error: { code, ...extra } };
}

export function succeed<T>(state: InventoryState, value: T): { ok: true; state: InventoryState; value: T } {
  return { ok: true, state, value };
}
