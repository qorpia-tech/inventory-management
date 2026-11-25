/**
 * Core domain types for QorStock Events.
 * Instants are UTC epoch milliseconds; the UI converts them to the company time zone.
 */

export type Role = "admin" | "coordinator" | "warehouse";

export interface Actor {
  id: string;
  name: string;
  roles: readonly Role[];
}

/** The clock is injected so tests and the demo can control time. */
export interface Clock {
  now(): number;
}

export interface CommandContext {
  actor: Actor;
  clock: Clock;
}

export type ArticleKind = "returnable" | "consumable";

export interface Article {
  id: string;
  sku: string;
  name: string;
  category: string;
  kind: ArticleKind;
  createdAt: number;
}

/** Physical buckets. Their sum is what the company holds. */
export interface StockLevel {
  available: number;
  washing: number;
  out: number;
}

export type PhysicalBucket = "available" | "washing" | "out";
export type Bucket =
  | PhysicalBucket
  | "opening"
  | "purchase"
  | "adjustment"
  | "broken"
  | "lost"
  | "consumed";

export type EventStatus = "draft" | "confirmed" | "in_progress" | "closed" | "cancelled";

export interface ReservationLine {
  id: string;
  articleId: string;
  requestedQty: number;
  committedQty: number;
  /** Undispatched balance the coordinator released (R4). */
  releasedQty: number;
  dispatchedQty: number;
  returnedGoodQty: number;
  returnedWashingQty: number;
  brokenQty: number;
  lostQty: number;
  /** Effective start of the commitment window: departure, or an earlier first dispatch. */
  windowStart: number;
}

export interface CateringEvent {
  id: string;
  name: string;
  customer: string;
  venue: string;
  /** Planned departure from the warehouse. */
  departureAt: number;
  /** When the material is ready again, washing included (R2). */
  readyAt: number;
  status: EventStatus;
  /** Optimistic concurrency for coordinator operations. */
  version: number;
  lines: ReservationLine[];
  closeNote?: string;
  createdAt: number;
  createdBy: string;
  confirmedAt?: number;
  confirmedBy?: string;
  cancelledAt?: number;
  closedAt?: number;
}

export type MovementKind =
  | "opening"
  | "receipt"
  | "adjustment"
  | "dispatch"
  | "return"
  | "washing_release"
  | "washing_loss";

export interface MovementLine {
  lineNo: number;
  articleId: string;
  quantity: number;
  from: Bucket;
  to: Bucket;
  reservationLineId?: string;
  washingBatchId?: string;
  reason?: string;
}

export interface Movement {
  id: string;
  kind: MovementKind;
  locationId: string;
  eventId?: string;
  reason?: string;
  acceptShortage?: boolean;
  recordedBy: { id: string; name: string };
  occurredAt: number;
  lines: MovementLine[];
}

export type WashingPurpose = "washing" | "maintenance";

export interface WashingBatch {
  id: string;
  articleId: string;
  eventId?: string;
  sourceMovementId: string;
  purpose: WashingPurpose;
  quantity: number;
  releasedQty: number;
  removedQty: number;
  createdAt: number;
}

export interface IdempotencyRecord {
  operation: string;
  fingerprint: string;
  response: unknown;
}

export interface InventoryState {
  schemaVersion: 1;
  companyId: string;
  locationId: string;
  locationName: string;
  articles: Article[];
  stock: Record<string, StockLevel>;
  batches: WashingBatch[];
  events: CateringEvent[];
  movements: Movement[];
  idempotency: Record<string, IdempotencyRecord>;
  sequence: number;
}
