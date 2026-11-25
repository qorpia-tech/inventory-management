import type { GatewayResult, QorStockGateway, SessionView, StaffCallView } from "@/application/gateway";
import {
  adjustStock,
  cancelEvent,
  can,
  PERMISSIONS,
  type Action,
  closeEvent,
  confirmEvent,
  createArticle,
  createDraft,
  dispatchEvent,
  getArticleView,
  getEventView,
  getStockOverview,
  listAgenda,
  listAlerts,
  listWashingBatches,
  registerOpening,
  registerReceipt,
  registerReturn,
  registerWashingLoss,
  releaseRemaining,
  releaseWashing,
  removeLine,
  setLineQuantity,
  updateDraft,
  type CommandContext,
  type CommandResult,
  type InventoryState,
  type Role,
} from "@/domain";
import { addDays, fromLima } from "@/lib/lima-time";
import { createDemoScenario, DEMO_COMPANY, DEMO_USERS, type DemoRefs } from "./seed";
import { getStaffCall } from "./staff";

export const STORAGE_KEY = "qorstock-demo:v1";

/** Minimal storage port, so tests use memory and the browser uses localStorage. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export type TourFlag = "weddingOpened" | "staffOpened" | "landingOpened";

export interface TourStepStatus {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  done: boolean;
}

export interface DemoSnapshot {
  role: Role;
  now: number;
  clockOffsetMs: number;
  refs: DemoRefs;
  tour: TourStepStatus[];
  /** The scenario was used and its Saturday is already in the past. */
  stale: boolean;
}

/** Presenter controls. They belong to the demo, never to the product gateway. */
export interface DemoControls {
  getDemo(): DemoSnapshot;
  setRole(role: Role): void;
  advanceClock(ms: number): void;
  jumpClockTo(epoch: number): void;
  markVisited(flag: TourFlag): void;
  reset(): GatewayResult<void>;
  subscribe(listener: () => void): () => void;
}

interface DemoDocument {
  version: 1;
  state: InventoryState;
  refs: DemoRefs;
  role: Role;
  clockOffsetMs: number;
  seededAt: number;
  dirty: boolean;
  flags: Record<TourFlag, boolean>;
}

const ROLES: readonly Role[] = ["admin", "coordinator", "warehouse"];

function isDocument(value: unknown): value is DemoDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<DemoDocument>;
  return (
    doc.version === 1 &&
    !!doc.state &&
    Array.isArray(doc.state.events) &&
    !!doc.refs &&
    typeof doc.refs.weddingId === "string" &&
    typeof doc.clockOffsetMs === "number" &&
    ROLES.includes(doc.role as Role) &&
    !!doc.flags
  );
}

function freshDocument(realNow: number, role: Role = "coordinator"): DemoDocument {
  const scenario = createDemoScenario(realNow);
  return {
    version: 1,
    state: scenario.state,
    refs: scenario.refs,
    role,
    clockOffsetMs: 0,
    seededAt: scenario.seededAt,
    dirty: false,
    flags: { weddingOpened: false, staffOpened: false, landingOpened: false },
  };
}

function toGateway<T>(result: CommandResult<T>): GatewayResult<T> {
  if (!result.ok) return { ok: false, error: result.error };
  return result.replayed ? { ok: true, value: result.value, replayed: true } : { ok: true, value: result.value };
}

export class LocalDemoGateway implements QorStockGateway, DemoControls {
  private doc: DemoDocument;
  private readonly listeners = new Set<() => void>();
  private readonly store: KeyValueStore;
  private readonly realNow: () => number;

  constructor(options: { store: KeyValueStore; realNow?: () => number }) {
    this.store = options.store;
    this.realNow = options.realNow ?? (() => Date.now());
    this.doc = this.load();
  }

  private load(): DemoDocument {
    const now = this.realNow();
    let stored: unknown = null;
    try {
      const raw = this.store.getItem(STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
    if (isDocument(stored)) {
      // An untouched scenario follows the calendar so the script always starts before its Saturday.
      const saturdayStart = fromLima(stored.refs.saturday, "00:00");
      if (stored.dirty || now < saturdayStart) return stored;
    }
    const fresh = freshDocument(now);
    this.save(fresh);
    return fresh;
  }

  private save(doc: DemoDocument = this.doc): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // Storage can be full or blocked (private mode). The demo keeps working in memory.
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private now(): number {
    return this.realNow() + this.doc.clockOffsetMs;
  }

  private ctx(): CommandContext {
    return { actor: DEMO_USERS[this.doc.role], clock: { now: () => this.now() } };
  }

  private run<T>(command: (state: InventoryState, ctx: CommandContext) => CommandResult<T>): Promise<GatewayResult<T>> {
    const result = command(this.doc.state, this.ctx());
    if (result.ok && !result.replayed) {
      this.doc = { ...this.doc, state: result.state, dirty: true };
      this.save();
      this.emit();
    }
    return Promise.resolve(toGateway(result));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- Presenter controls -------------------------------------------------

  getDemo(): DemoSnapshot {
    const { state, refs, flags } = this.doc;
    const view = getEventView(state, refs.weddingId, this.now());
    const cups = view?.lines.find((line) => line.articleId === refs.cupsId);
    const confirmed = !!view && view.status !== "draft" && view.status !== "cancelled" && (cups?.committed ?? 0) >= 90;
    const dispatched = (cups?.dispatched ?? 0) >= 90;
    const steps: boolean[] = [
      flags.weddingOpened,
      confirmed,
      dispatched,
      (cups?.returnedGood ?? 0) >= 86 && (cups?.broken ?? 0) >= 2,
      dispatched && cups?.pendingReturn === 0,
      flags.staffOpened && flags.landingOpened,
    ];
    const staleAfter = fromLima(addDays(refs.saturday, 1), "23:59");
    return {
      role: this.doc.role,
      now: this.now(),
      clockOffsetMs: this.doc.clockOffsetMs,
      refs,
      tour: steps.map((done, index) => ({ step: (index + 1) as TourStepStatus["step"], done })),
      stale: this.doc.dirty && this.realNow() > staleAfter,
    };
  }

  setRole(role: Role): void {
    if (!ROLES.includes(role) || role === this.doc.role) return;
    this.doc = { ...this.doc, role };
    this.save();
    this.emit();
  }

  advanceClock(ms: number): void {
    if (!(ms > 0)) return;
    this.doc = { ...this.doc, clockOffsetMs: this.doc.clockOffsetMs + ms };
    this.save();
    this.emit();
  }

  jumpClockTo(epoch: number): void {
    this.advanceClock(epoch - this.now());
  }

  markVisited(flag: TourFlag): void {
    if (this.doc.flags[flag]) return;
    this.doc = { ...this.doc, flags: { ...this.doc.flags, [flag]: true } };
    this.save();
    this.emit();
  }

  /** Restores the fictional scenario. Only the administrator of the demo company may do it (design §6.8). */
  reset(): GatewayResult<void> {
    if (!can(DEMO_USERS[this.doc.role], "demo.reset")) return { ok: false, error: { code: "forbidden" } };
    this.doc = freshDocument(this.realNow(), this.doc.role);
    this.save();
    this.emit();
    return { ok: true, value: undefined };
  }

  // ---- Queries -------------------------------------------------------------

  getSession(): Promise<SessionView> {
    return Promise.resolve({
      actor: DEMO_USERS[this.doc.role],
      companyName: DEMO_COMPANY.name,
      locationName: DEMO_COMPANY.locationName,
      timeZone: "America/Lima",
      permissions: (Object.keys(PERMISSIONS) as Action[]).filter((action) => can(DEMO_USERS[this.doc.role], action)),
      now: this.now(),
    });
  }

  listAgenda() {
    return Promise.resolve(listAgenda(this.doc.state, this.now()));
  }

  getEvent(eventId: string) {
    return Promise.resolve(getEventView(this.doc.state, eventId, this.now()));
  }

  listArticles() {
    return Promise.resolve(
      [...this.doc.state.articles]
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((a) => ({ id: a.id, sku: a.sku, name: a.name, kind: a.kind })),
    );
  }

  getStock() {
    return Promise.resolve(getStockOverview(this.doc.state, this.now()));
  }

  getArticle(articleId: string) {
    return Promise.resolve(getArticleView(this.doc.state, articleId, this.now()));
  }

  listWashingBatches() {
    return Promise.resolve(listWashingBatches(this.doc.state));
  }

  listAlerts() {
    return Promise.resolve(listAlerts(this.doc.state, this.now()));
  }

  getStaffCall(): Promise<StaffCallView | null> {
    const data = getStaffCall(this.doc.refs);
    const event = this.doc.state.events.find((e) => e.id === data.eventId);
    if (!event) return Promise.resolve(null);
    return Promise.resolve({ ...data, eventName: event.name, venue: event.venue });
  }

  // ---- Commands ------------------------------------------------------------

  createDraft(input: Parameters<QorStockGateway["createDraft"]>[0]) {
    return this.run((state, ctx) => createDraft(state, input, ctx));
  }
  updateDraft(input: Parameters<QorStockGateway["updateDraft"]>[0]) {
    return this.run((state, ctx) => updateDraft(state, input, ctx));
  }
  setLineQuantity(input: Parameters<QorStockGateway["setLineQuantity"]>[0]) {
    return this.run((state, ctx) => setLineQuantity(state, input, ctx));
  }
  removeLine(input: Parameters<QorStockGateway["removeLine"]>[0]) {
    return this.run((state, ctx) => removeLine(state, input, ctx));
  }
  confirmEvent(input: Parameters<QorStockGateway["confirmEvent"]>[0]) {
    return this.run((state, ctx) => confirmEvent(state, input, ctx));
  }
  cancelEvent(input: Parameters<QorStockGateway["cancelEvent"]>[0]) {
    return this.run((state, ctx) => cancelEvent(state, input, ctx));
  }
  releaseRemaining(input: Parameters<QorStockGateway["releaseRemaining"]>[0]) {
    return this.run((state, ctx) => releaseRemaining(state, input, ctx));
  }
  closeEvent(input: Parameters<QorStockGateway["closeEvent"]>[0]) {
    return this.run((state, ctx) => closeEvent(state, input, ctx));
  }
  dispatch(input: Parameters<QorStockGateway["dispatch"]>[0]) {
    return this.run((state, ctx) => dispatchEvent(state, input, ctx));
  }
  registerReturn(input: Parameters<QorStockGateway["registerReturn"]>[0]) {
    return this.run((state, ctx) => registerReturn(state, input, ctx));
  }
  releaseWashing(input: Parameters<QorStockGateway["releaseWashing"]>[0]) {
    return this.run((state, ctx) => releaseWashing(state, input, ctx));
  }
  registerWashingLoss(input: Parameters<QorStockGateway["registerWashingLoss"]>[0]) {
    return this.run((state, ctx) => registerWashingLoss(state, input, ctx));
  }
  createArticle(input: Parameters<QorStockGateway["createArticle"]>[0]) {
    return this.run((state, ctx) => createArticle(state, input, ctx));
  }
  registerOpening(input: Parameters<QorStockGateway["registerOpening"]>[0]) {
    return this.run((state, ctx) => registerOpening(state, input, ctx));
  }
  registerReceipt(input: Parameters<QorStockGateway["registerReceipt"]>[0]) {
    return this.run((state, ctx) => registerReceipt(state, input, ctx));
  }
  adjustStock(input: Parameters<QorStockGateway["adjustStock"]>[0]) {
    return this.run((state, ctx) => adjustStock(state, input, ctx));
  }
}

/** Browser storage wrapped so a blocked or missing localStorage never breaks the demo. */
export function browserStore(): KeyValueStore {
  try {
    const storage = globalThis.localStorage;
    const probe = "qorstock-demo:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return new MemoryStore();
  }
}
