import { describe, expect, it } from "vitest";
import {
  closeEvent,
  confirmEvent,
  createDraft,
  dispatchEvent,
  getEventView,
  listAlerts,
  registerReturn,
  setLineQuantity,
  type InventoryState,
} from "@/domain";
import { createDemoScenario, DEMO_USERS, type DemoRefs } from "@/demo/seed";
import { getStaffCall } from "@/demo/staff";
import { buildWhatsAppUrl, getPublishedStorefront } from "@/demo/storefront";
import { lima, TestClock } from "./helpers";

const coordinator = DEMO_USERS.coordinator;
const warehouse = DEMO_USERS.warehouse;

function cupsLine(state: InventoryState, refs: DemoRefs, now: number) {
  const view = getEventView(state, refs.weddingId, now);
  return view?.lines.find((line) => line.articleId === refs.cupsId);
}

describe("Spec §5 demo script, step by step", () => {
  // A Wednesday morning in Lima, three days before the fictional Saturday.
  const clock = new TestClock(lima("2026-11-25T09:00"));
  const seeded = createDemoScenario(clock.now());
  let state = seeded.state;
  const refs = seeded.refs;
  const at = (actor: typeof coordinator) => ({ actor, clock });

  it("prepares a fictional Saturday with two overlapping events and the starting stock", () => {
    expect(refs.saturday).toBe("2026-11-28");
    expect(state.stock[refs.cupsId]).toEqual({ available: 270, washing: 30, out: 0 });
    const lunch = getEventView(state, refs.lunchId, clock.now());
    expect(lunch?.status).toBe("confirmed");
    expect(lunch?.lines.find((l) => l.articleId === refs.cupsId)?.committed).toBe(180);
    const wedding = getEventView(state, refs.weddingId, clock.now());
    expect(wedding?.status).toBe("draft");
    expect(wedding?.lines.find((l) => l.articleId === refs.cupsId)?.requested).toBe(100);
    expect(lunch!.departureAt < wedding!.departureAt && wedding!.departureAt < lunch!.readyAt).toBe(true);
    // Seed movements never happen after the demo starts.
    expect(Math.max(...state.movements.map((m) => m.occurredAt))).toBeLessThanOrEqual(clock.now());
    for (const kind of ["returnable", "consumable"] as const) {
      expect(state.articles.some((a) => a.kind === kind)).toBe(true);
    }
  });

  it("step 1: opening the wedding and asking for 100 cups shows 90 available and 10 missing; the wedding stays a draft", () => {
    const view = getEventView(state, refs.weddingId, clock.now());
    expect(view?.lines.find((l) => l.articleId === refs.cupsId)).toMatchObject({ requested: 100, available: 90, missing: 10 });
    const attempt = confirmEvent(state, { eventId: refs.weddingId }, at(coordinator));
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.error.shortages).toEqual([
      { lineId: expect.any(String), articleId: refs.cupsId, requested: 100, available: 90, missing: 10 },
    ]);
    expect(getEventView(state, refs.weddingId, clock.now())?.status).toBe("draft");
  });

  it("step 2: changing to 90 and confirming reserves 90; another simultaneous event finds zero free cups", () => {
    const changed = setLineQuantity(state, { eventId: refs.weddingId, articleId: refs.cupsId, quantity: 90 }, at(coordinator));
    if (!changed.ok) throw new Error(changed.error.code);
    const confirmed = confirmEvent(changed.state, { eventId: refs.weddingId }, at(coordinator));
    if (!confirmed.ok) throw new Error(confirmed.error.code);
    state = confirmed.state;
    expect(cupsLine(state, refs, clock.now())).toMatchObject({ committed: 90, freeForOthers: 0 });

    const wedding = state.events.find((e) => e.id === refs.weddingId)!;
    const other = createDraft(
      state,
      {
        name: "Simultaneous event",
        customer: "Fictional",
        venue: "Fictional",
        departureAt: wedding.departureAt + 60 * 60 * 1000,
        readyAt: wedding.readyAt - 60 * 60 * 1000,
        lines: [{ articleId: refs.cupsId, quantity: 1 }],
      },
      at(coordinator),
    );
    if (!other.ok) throw new Error(other.error.code);
    expect(getEventView(other.state, other.value.eventId, clock.now())?.lines[0]).toMatchObject({ available: 0, missing: 1 });
  });

  it("step 3: dispatching the 90 cups shows 90 out of the warehouse", () => {
    clock.set("2026-11-28T13:40");
    const view = getEventView(state, refs.weddingId, clock.now())!;
    const dispatched = dispatchEvent(
      state,
      { eventId: refs.weddingId, lines: view.lines.map((l) => ({ lineId: l.lineId, quantity: l.toDispatch })), idempotencyKey: "wedding-dispatch" },
      at(warehouse),
    );
    if (!dispatched.ok) throw new Error(dispatched.error.code);
    state = dispatched.state;
    const after = getEventView(state, refs.weddingId, clock.now())!;
    expect(after.status).toBe("in_progress");
    expect(after.totals.out).toBe(90);
    expect(state.stock[refs.cupsId]).toEqual({ available: 180, washing: 30, out: 90 });
    // Persisted state is plain data, so a reload keeps the record.
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("step 4: receiving 86 good and 2 broken leaves 2 pending and the event open", () => {
    clock.set("2026-11-29T10:30");
    const lineId = cupsLine(state, refs, clock.now())!.lineId;
    const received = registerReturn(
      state,
      { eventId: refs.weddingId, lines: [{ lineId, good: 86, broken: 2, brokenReason: "Broken during the toast" }], idempotencyKey: "wedding-return-1" },
      at(warehouse),
    );
    if (!received.ok) throw new Error(received.error.code);
    state = received.state;
    expect(cupsLine(state, refs, clock.now())).toMatchObject({ pendingReturn: 2, returnedGood: 86, broken: 2 });
    const view = getEventView(state, refs.weddingId, clock.now())!;
    expect(view.status).toBe("in_progress");
    expect(view.canClose).toBe(false);
  });

  it("step 5: receiving the last 2 for washing brings the pending balance to zero, allows closing and leaves 2 in washing linked to this return", () => {
    const lineId = cupsLine(state, refs, clock.now())!.lineId;
    const received = registerReturn(state, { eventId: refs.weddingId, lines: [{ lineId, washing: 2 }], idempotencyKey: "wedding-return-2" }, at(warehouse));
    if (!received.ok) throw new Error(received.error.code);
    state = received.state;
    expect(cupsLine(state, refs, clock.now())?.pendingReturn).toBe(0);
    const view = getEventView(state, refs.weddingId, clock.now())!;
    expect(view.canClose).toBe(true);
    expect(view.washingBatches).toEqual([
      expect.objectContaining({ articleId: refs.cupsId, quantity: 2, remaining: 2, sourceMovementId: received.value.movementId }),
    ]);
    expect(state.stock[refs.cupsId]).toEqual({ available: 266, washing: 32, out: 0 });

    const closed = closeEvent(state, { eventId: refs.weddingId }, at(coordinator));
    if (!closed.ok) throw new Error(closed.error.code);
    expect(getEventView(closed.state, refs.weddingId, clock.now())?.status).toBe("closed");
    expect(listAlerts(closed.state, clock.now()).filter((a) => a.kind === "overdue")).toEqual([]);
  });

  it("step 6: the 16:00 call shows one arrival at 16:12 and one person without a record; the landing opens an editable WhatsApp inquiry", () => {
    const call = getStaffCall(refs);
    expect(call.workers).toHaveLength(4);
    expect(new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(call.callAt)).toBe("16:00");
    const arrivals = call.workers.map((w) =>
      w.arrivedAt === null ? null : new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }).format(w.arrivedAt),
    );
    expect(arrivals).toContain("16:12");
    expect(arrivals.filter((a) => a === null)).toHaveLength(1);

    const storefront = getPublishedStorefront("valtiera");
    expect(storefront?.services.length).toBeGreaterThanOrEqual(3);
    const url = buildWhatsAppUrl("Hola, quisiera cotizar una boda para 120 invitados en Barranco.");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1]!)).toContain("120 invitados en Barranco");
  });
});

describe("Overdue demonstration with the demo clock", () => {
  it("moving the clock past the wedding's ready time with cups still out flags the overdue and the conflict with the Sunday dinner", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    const { state: seededState, refs } = createDemoScenario(clock.now());
    let state = seededState;
    const at = (actor: typeof coordinator) => ({ actor, clock });
    const r = setLineQuantity(state, { eventId: refs.weddingId, articleId: refs.cupsId, quantity: 90 }, at(coordinator));
    if (!r.ok) throw new Error(r.error.code);
    const c = confirmEvent(r.state, { eventId: refs.weddingId }, at(coordinator));
    if (!c.ok) throw new Error(c.error.code);
    state = c.state;
    const lines = getEventView(state, refs.weddingId, clock.now())!.lines.map((l) => ({ lineId: l.lineId, quantity: l.toDispatch }));
    const d = dispatchEvent(state, { eventId: refs.weddingId, lines }, at(warehouse));
    if (!d.ok) throw new Error(d.error.code);
    state = d.state;

    clock.set("2026-11-29T13:00");
    const alerts = listAlerts(state, clock.now());
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "overdue", eventId: refs.weddingId, articleId: refs.cupsId, quantity: 90 }));
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "conflict", articleId: refs.cupsId, shortage: 20, affectedEventIds: [refs.dinnerId] }));
  });
});
