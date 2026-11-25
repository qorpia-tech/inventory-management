/**
 * Port between the screens and the business rules. The demo implements it in the browser;
 * a later HTTP adapter implements the same interface against the real API.
 */
import type {
  Action,
  Actor,
  AgendaItem,
  Alert,
  ArticleKind,
  ArticleView,
  DispatchLineInput,
  DomainError,
  DraftInput,
  EventView,
  ReturnLineInput,
  StockRow,
  WashingBatchView,
} from "@/domain";

export type {
  Action,
  Actor,
  AgendaItem,
  Alert,
  ArticleKind,
  ArticleView,
  DomainError,
  DomainErrorCode,
  EventLineView,
  EventStatus,
  EventView,
  LedgerEntry,
  MovementKind,
  Bucket,
  Role,
  ShortageLine,
  StockRow,
  WashingBatchView,
} from "@/domain";

export type GatewayResult<T> = { ok: true; value: T; replayed?: boolean } | { ok: false; error: DomainError };

export interface SessionView {
  actor: Actor;
  companyName: string;
  locationName: string;
  timeZone: string;
  /** Actions the current user may perform (design §2). */
  permissions: Action[];
  /** Server time. In the demo it is the demo clock. */
  now: number;
}

export interface ArticleOption {
  id: string;
  sku: string;
  name: string;
  kind: ArticleKind;
}

export interface StaffCallWorker {
  id: string;
  name: string;
  role: string;
  expectedAt: number;
  arrivedAt: number | null;
}

export interface StaffCallView {
  eventId: string;
  eventName: string;
  venue: string;
  callAt: number;
  toleranceMinutes: number;
  workers: StaffCallWorker[];
}

type Versioned = { expectedVersion?: number };
type Keyed = { idempotencyKey?: string };

export interface QorStockGateway {
  getSession(): Promise<SessionView>;
  listAgenda(): Promise<AgendaItem[]>;
  getEvent(eventId: string): Promise<EventView | null>;
  listArticles(): Promise<ArticleOption[]>;
  getStock(): Promise<StockRow[]>;
  getArticle(articleId: string): Promise<ArticleView | null>;
  listWashingBatches(): Promise<WashingBatchView[]>;
  listAlerts(): Promise<Alert[]>;
  getStaffCall(): Promise<StaffCallView | null>;

  createDraft(input: DraftInput): Promise<GatewayResult<{ eventId: string }>>;
  updateDraft(input: { eventId: string } & Versioned & Partial<Omit<DraftInput, "lines">>): Promise<GatewayResult<{ version: number }>>;
  setLineQuantity(input: { eventId: string; articleId: string; quantity: number } & Versioned): Promise<GatewayResult<{ version: number }>>;
  removeLine(input: { eventId: string; articleId: string } & Versioned): Promise<GatewayResult<{ version: number }>>;
  confirmEvent(input: { eventId: string } & Versioned & Keyed): Promise<GatewayResult<{ version: number }>>;
  cancelEvent(input: { eventId: string } & Versioned): Promise<GatewayResult<{ version: number }>>;
  releaseRemaining(input: { eventId: string } & Versioned): Promise<GatewayResult<{ released: number; version: number }>>;
  closeEvent(input: { eventId: string; note?: string } & Versioned): Promise<GatewayResult<{ version: number }>>;

  dispatch(input: { eventId: string; lines: DispatchLineInput[] } & Keyed): Promise<GatewayResult<{ movementId: string }>>;
  registerReturn(input: { eventId: string; lines: ReturnLineInput[] } & Keyed): Promise<GatewayResult<{ movementId: string }>>;
  releaseWashing(input: { batchId: string; quantity: number } & Keyed): Promise<GatewayResult<{ movementId: string }>>;
  registerWashingLoss(
    input: { batchId: string; quantity: number; outcome: "broken" | "lost"; reason: string } & Keyed,
  ): Promise<GatewayResult<{ movementId: string }>>;

  createArticle(input: { sku: string; name: string; category: string; kind: ArticleKind }): Promise<GatewayResult<{ articleId: string }>>;
  registerOpening(input: { articleId: string; available: number; washing: number }): Promise<GatewayResult<{ movementId: string }>>;
  registerReceipt(input: { articleId: string; quantity: number; note?: string } & Keyed): Promise<GatewayResult<{ movementId: string }>>;
  adjustStock(
    input: { articleId: string; delta: number; reason: string; acceptShortage?: boolean } & Keyed,
  ): Promise<GatewayResult<{ movementId: string }>>;

  /** Notifies when data changed, so screens can reload. */
  subscribe(listener: () => void): () => void;
}
