import { describe, expect, it } from "vitest";
import {
  availabilityFor,
  cancelEvent,
  closeEvent,
  confirmEvent,
  dispatchEvent,
  getEventView,
  listAlerts,
  registerReturn,
} from "@/domain";
import {
  addArticle,
  addConfirmed,
  addDraft,
  coordinator,
  coordinatorB,
  ctx,
  emptyState,
  expectError,
  lima,
  lineOf,
  TestClock,
  unwrap,
  warehouse,
} from "./helpers";

describe("Spec §6 acceptance criteria that live in the domain", () => {
  it("only one of two simultaneous confirmations for the last 90 cups succeeds; the other gets the updated shortage", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 270, washing: 30 });
    ({ state } = addConfirmed(state, clock, {
      name: "Lunch",
      from: "2026-11-28T08:30",
      to: "2026-11-28T18:00",
      lines: [{ articleId: cups, quantity: 180 }],
    }));
    const a = addDraft(state, clock, { name: "Event A", from: "2026-11-28T14:00", to: "2026-11-29T12:00", lines: [{ articleId: cups, quantity: 90 }] });
    const b = addDraft(a.state, clock, { name: "Event B", from: "2026-11-28T15:00", to: "2026-11-29T10:00", lines: [{ articleId: cups, quantity: 90 }] }, coordinatorB);
    state = b.state;

    // Both coordinators saw 90 available a moment before confirming.
    expect(getEventView(state, a.eventId, clock.now())?.lines[0]?.available).toBe(90);
    expect(getEventView(state, b.eventId, clock.now())?.lines[0]?.available).toBe(90);

    const first = unwrap(confirmEvent(state, { eventId: a.eventId }, ctx(coordinator, clock)));
    const second = expectError(confirmEvent(first.state, { eventId: b.eventId }, ctx(coordinatorB, clock)));

    expect(second.code).toBe("shortage");
    expect(second.shortages).toEqual([{ lineId: expect.any(String), articleId: cups, requested: 90, available: 0, missing: 90 }]);
    expect(first.state.events.find((e) => e.id === b.eventId)?.status).toBe("draft");
    expect(lineOf(first.state, b.eventId, cups).committedQty).toBe(0);
  });

  it("two consecutive orders of 40 inside a long interval commit at most 40 at the same time when the material is ready between them", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId: plates } = addArticle(emptyState(), clock, { sku: "PLT", name: "Plate", available: 50 });
    ({ state } = addConfirmed(state, clock, { name: "Morning", from: "2026-11-28T10:00", to: "2026-11-28T14:00", lines: [{ articleId: plates, quantity: 40 }] }));
    ({ state } = addConfirmed(state, clock, { name: "Evening", from: "2026-11-28T14:00", to: "2026-11-28T20:00", lines: [{ articleId: plates, quantity: 40 }] }));

    const longInterval = availabilityFor(state, plates, { from: lima("2026-11-28T08:00"), to: lima("2026-11-28T22:00") }, clock.now());
    expect(longInterval.peak).toBe(40);
    expect(longInterval.available).toBe(10);
  });

  it("a double tap on the return keeps a single receipt", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 20 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Event", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId: cups, quantity: 10 }] }));
    const lineId = lineOf(state, eventId, cups).id;
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId, quantity: 10 }], idempotencyKey: "dispatch-1" }, ctx(warehouse, clock))));

    const request = { eventId, lines: [{ lineId, good: 10 }], idempotencyKey: "return-tap" };
    const firstTap = unwrap(registerReturn(state, request, ctx(warehouse, clock)));
    const secondTap = registerReturn(firstTap.state, request, ctx(warehouse, clock));

    expect(secondTap.ok).toBe(true);
    if (!secondTap.ok) return;
    expect(secondTap.replayed).toBe(true);
    expect(secondTap.value).toEqual(firstTap.value);
    expect(secondTap.state.movements.filter((m) => m.kind === "return")).toHaveLength(1);
    expect(lineOf(secondTap.state, eventId, cups).returnedGoodQty).toBe(10);
    expect(secondTap.state.stock[cups]).toEqual({ available: 20, washing: 0, out: 0 });
  });

  it("an attempt above the pending balance is rejected entirely, including its valid lines", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 20 });
    let plates: string;
    ({ state, articleId: plates } = addArticle(state, clock, { sku: "PLT", name: "Plate", available: 20 }));
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, {
      name: "Event",
      from: "2026-11-28T09:00",
      to: "2026-11-28T20:00",
      lines: [
        { articleId: cups, quantity: 10 },
        { articleId: plates, quantity: 4 },
      ],
    }));
    const cupLine = lineOf(state, eventId, cups).id;
    const plateLine = lineOf(state, eventId, plates).id;
    ({ state } = unwrap(
      dispatchEvent(state, { eventId, lines: [{ lineId: cupLine, quantity: 10 }, { lineId: plateLine, quantity: 4 }] }, ctx(warehouse, clock)),
    ));

    const before = structuredClone(state);
    const error = expectError(
      registerReturn(state, { eventId, lines: [{ lineId: cupLine, good: 6 }, { lineId: plateLine, good: 3, washing: 2 }] }, ctx(warehouse, clock)),
    );
    expect(error.code).toBe("over_receipt");
    expect(error.overReceipts).toEqual([{ lineId: plateLine, articleId: plates, pending: 4, attempted: 5 }]);
    expect(state).toEqual(before);

    // Cumulative receipts are checked too.
    ({ state } = unwrap(registerReturn(state, { eventId, lines: [{ lineId: cupLine, good: 6 }] }, ctx(warehouse, clock))));
    const cumulative = expectError(registerReturn(state, { eventId, lines: [{ lineId: cupLine, good: 5 }] }, ctx(warehouse, clock)));
    expect(cumulative.code).toBe("over_receipt");
    expect(cumulative.overReceipts?.[0]).toMatchObject({ pending: 4, attempted: 5 });
  });

  it("cancelling before dispatch frees the stock of the interval", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Event", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId: cups, quantity: 100 }] }));
    const window = { from: lima("2026-11-28T10:00"), to: lima("2026-11-28T12:00") };
    expect(availabilityFor(state, cups, window, clock.now()).available).toBe(0);

    const cancelled = unwrap(cancelEvent(state, { eventId }, ctx(coordinator, clock)));
    expect(cancelled.state.events.find((e) => e.id === eventId)?.status).toBe("cancelled");
    expect(availabilityFor(cancelled.state, cups, window, clock.now()).available).toBe(100);
  });

  it("an event with dispatched material cannot be cancelled", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Event", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId: cups, quantity: 50 }] }));
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId: lineOf(state, eventId, cups).id, quantity: 10 }] }, ctx(warehouse, clock))));
    expect(expectError(cancelEvent(state, { eventId }, ctx(coordinator, clock))).code).toBe("cancel_blocked");
  });

  it("a late return reveals the conflict with the next reservation and blocks its dispatch", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId: plates } = addArticle(emptyState(), clock, { sku: "PLT", name: "Plate", available: 100 });
    let first: string;
    let next: string;
    ({ state, eventId: first } = addConfirmed(state, clock, { name: "First", from: "2026-11-28T09:00", to: "2026-11-29T12:00", lines: [{ articleId: plates, quantity: 100 }] }));
    ({ state, eventId: next } = addConfirmed(state, clock, { name: "Next", from: "2026-11-29T15:00", to: "2026-11-30T11:00", lines: [{ articleId: plates, quantity: 100 }] }));
    ({ state } = unwrap(dispatchEvent(state, { eventId: first, lines: [{ lineId: lineOf(state, first, plates).id, quantity: 100 }] }, ctx(warehouse, clock))));
    expect(listAlerts(state, clock.now())).toEqual([]);

    // The planned return passes with the plates still out.
    clock.set("2026-11-29T13:00");
    const alerts = listAlerts(state, clock.now());
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "overdue", eventId: first, articleId: plates, quantity: 100 }));
    expect(alerts).toContainEqual(
      expect.objectContaining({ kind: "conflict", articleId: plates, shortage: 100, affectedEventIds: [next] }),
    );

    clock.set("2026-11-29T15:30");
    const blocked = expectError(
      dispatchEvent(state, { eventId: next, lines: [{ lineId: lineOf(state, next, plates).id, quantity: 10 }] }, ctx(warehouse, clock)),
    );
    expect(blocked.code).toBe("unresolved_conflict");
    expect(blocked.shortages?.[0]).toMatchObject({ articleId: plates, missing: 100 });
  });

  it("dispatching 50 disposable cups deducts 50 units and lets that line close without a return", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId: disposable } = addArticle(emptyState(), clock, { sku: "DSP", name: "Disposable cup", kind: "consumable", available: 500 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Event", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId: disposable, quantity: 50 }] }));
    const lineId = lineOf(state, eventId, disposable).id;
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId, quantity: 50 }] }, ctx(warehouse, clock))));

    expect(state.stock[disposable]).toEqual({ available: 450, washing: 0, out: 0 });
    const movement = state.movements.find((m) => m.kind === "dispatch");
    expect(movement?.lines[0]).toMatchObject({ quantity: 50, from: "available", to: "consumed" });
    const view = getEventView(state, eventId, clock.now());
    expect(view?.lines[0]).toMatchObject({ pendingReturn: 0, openCommitment: 0 });
    expect(view?.canClose).toBe(true);

    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId, good: 1 }] }, ctx(warehouse, clock))).code).toBe("consumable_return");
    const closed = unwrap(closeEvent(state, { eventId }, ctx(coordinator, clock)));
    expect(closed.state.events.find((e) => e.id === eventId)?.status).toBe("closed");
  });
});
