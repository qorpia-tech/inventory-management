import { describe, expect, it } from "vitest";
import {
  adjustStock,
  availabilityFor,
  can,
  closeEvent,
  confirmEvent,
  createArticle,
  dispatchEvent,
  listLedger,
  registerOpening,
  registerReceipt,
  registerReturn,
  releaseRemaining,
  releaseWashing,
  setLineQuantity,
  updateDraft,
} from "@/domain";
import {
  addArticle,
  addConfirmed,
  addDraft,
  admin,
  coordinator,
  ctx,
  emptyState,
  expectError,
  lima,
  lineOf,
  TestClock,
  unwrap,
  warehouse,
} from "./helpers";

describe("Permissions (design §2 matrix)", () => {
  it("maps each role to its own actions without inheritance", () => {
    expect(can(admin, "stock.adjust")).toBe(true);
    expect(can(admin, "event.lifecycle")).toBe(false);
    expect(can(coordinator, "event.edit")).toBe(true);
    expect(can(coordinator, "warehouse.operate")).toBe(false);
    expect(can(warehouse, "warehouse.operate")).toBe(true);
    expect(can(warehouse, "stock.receipt")).toBe(true);
    expect(can(warehouse, "stock.adjust")).toBe(false);
    expect(can(warehouse, "staff.view")).toBe(false);
    expect(can(admin, "demo.reset")).toBe(true);
    expect(can(coordinator, "demo.reset")).toBe(false);
  });

  it("rejects commands from roles without the permission", () => {
    const clock = new TestClock(lima("2026-11-28T08:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 10 });
    let eventId: string;
    ({ state, eventId } = addDraft(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 5 }] }));
    expect(expectError(confirmEvent(state, { eventId }, ctx(warehouse, clock))).code).toBe("forbidden");
    ({ state } = unwrap(confirmEvent(state, { eventId }, ctx(coordinator, clock))));
    const lineId = lineOf(state, eventId, articleId).id;
    expect(expectError(dispatchEvent(state, { eventId, lines: [{ lineId, quantity: 5 }] }, ctx(coordinator, clock))).code).toBe("forbidden");
    expect(expectError(createArticle(state, { sku: "X", name: "X", category: "X", kind: "returnable" }, ctx(warehouse, clock))).code).toBe("forbidden");
  });
});

describe("Confirmation (R3)", () => {
  it("validates all lines together: one short line keeps the whole draft uncommitted", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId: cups } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let plates: string;
    ({ state, articleId: plates } = addArticle(state, clock, { sku: "PLT", name: "Plate", available: 10 }));
    let eventId: string;
    ({ state, eventId } = addDraft(state, clock, {
      name: "E",
      from: "2026-11-28T09:00",
      to: "2026-11-28T20:00",
      lines: [
        { articleId: cups, quantity: 50 },
        { articleId: plates, quantity: 12 },
      ],
    }));
    const error = expectError(confirmEvent(state, { eventId }, ctx(coordinator, clock)));
    expect(error.code).toBe("shortage");
    expect(error.shortages).toEqual([{ lineId: expect.any(String), articleId: plates, requested: 12, available: 10, missing: 2 }]);
    expect(state.events[0]?.status).toBe("draft");
    expect(lineOf(state, eventId, cups).committedQty).toBe(0);
  });

  it("rejects a stale version so a second coordinator does not overwrite a newer draft", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addDraft(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 5 }] }));
    const seen = state.events[0]!.version;
    ({ state } = unwrap(setLineQuantity(state, { eventId, articleId, quantity: 6, expectedVersion: seen }, ctx(coordinator, clock))));
    expect(expectError(confirmEvent(state, { eventId, expectedVersion: seen }, ctx(coordinator, clock))).code).toBe("stale_version");
  });

  it("requires the ready time to be after the departure", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let eventId: string;
    let state = emptyState();
    ({ state, eventId } = addDraft(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [] }));
    const error = expectError(
      updateDraft(state, { eventId, departureAt: lima("2026-11-28T20:00"), readyAt: lima("2026-11-28T20:00") }, ctx(coordinator, clock)),
    );
    expect(error.code).toBe("invalid_dates");
  });

  it("increasing a confirmed line revalidates availability (R4)", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "A", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 60 }] }));
    ({ state } = addConfirmed(state, clock, { name: "B", from: "2026-11-28T10:00", to: "2026-11-28T18:00", lines: [{ articleId, quantity: 30 }] }));
    const error = expectError(setLineQuantity(state, { eventId, articleId, quantity: 75 }, ctx(coordinator, clock)));
    expect(error.code).toBe("shortage");
    expect(error.shortages?.[0]).toMatchObject({ requested: 75, available: 70, missing: 5 });
    ({ state } = unwrap(setLineQuantity(state, { eventId, articleId, quantity: 70 }, ctx(coordinator, clock))));
    expect(lineOf(state, eventId, articleId).committedQty).toBe(70);
  });
});

describe("Dispatch (R1, R4)", () => {
  it("turns the commitment into units out without counting them twice", () => {
    const clock = new TestClock(lima("2026-11-28T09:30"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 60 }] }));
    const window = { from: lima("2026-11-28T10:00"), to: lima("2026-11-28T12:00") };
    const before = availabilityFor(state, articleId, window, clock.now()).available;
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId: lineOf(state, eventId, articleId).id, quantity: 60 }] }, ctx(warehouse, clock))));
    expect(state.stock[articleId]).toEqual({ available: 40, washing: 0, out: 60 });
    expect(availabilityFor(state, articleId, window, clock.now()).available).toBe(before);
    expect(state.events[0]?.status).toBe("in_progress");
  });

  it("allows partial dispatch; the rest stays reserved until released", () => {
    const clock = new TestClock(lima("2026-11-28T09:30"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 60 }] }));
    const lineId = lineOf(state, eventId, articleId).id;
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId, quantity: 50 }] }, ctx(warehouse, clock))));
    const window = { from: lima("2026-11-28T10:00"), to: lima("2026-11-28T12:00") };
    expect(availabilityFor(state, articleId, window, clock.now()).available).toBe(40);
    expect(expectError(dispatchEvent(state, { eventId, lines: [{ lineId, quantity: 11 }] }, ctx(warehouse, clock))).code).toBe("over_dispatch");

    ({ state } = unwrap(registerReturn(state, { eventId, lines: [{ lineId, good: 50 }] }, ctx(warehouse, clock))));
    expect(expectError(closeEvent(state, { eventId }, ctx(coordinator, clock))).closeBlockers).toEqual([
      { lineId, articleId, toDispatch: 10, pendingReturn: 0 },
    ]);
    ({ state } = unwrap(releaseRemaining(state, { eventId }, ctx(coordinator, clock))));
    expect(availabilityFor(state, articleId, window, clock.now()).available).toBe(100);
    expect(unwrap(closeEvent(state, { eventId }, ctx(coordinator, clock))).state.events[0]?.status).toBe("closed");
  });

  it("rejects a dispatch at or after the end of the window", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 60 }] }));
    clock.set("2026-11-28T20:00");
    const error = expectError(dispatchEvent(state, { eventId, lines: [{ lineId: lineOf(state, eventId, articleId).id, quantity: 1 }] }, ctx(warehouse, clock)));
    expect(error.code).toBe("reservation_expired");
  });

  it("an early dispatch moves the window start after validating the new part", () => {
    const clock = new TestClock(lima("2026-11-27T18:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Late", from: "2026-11-28T14:00", to: "2026-11-28T23:00", lines: [{ articleId, quantity: 60 }] }));
    let morning: string;
    ({ state, eventId: morning } = addConfirmed(state, clock, { name: "Morning", from: "2026-11-28T08:00", to: "2026-11-28T14:00", lines: [{ articleId, quantity: 50 }] }));
    const lateLine = lineOf(state, eventId, articleId).id;
    const error = expectError(dispatchEvent(state, { eventId, lines: [{ lineId: lateLine, quantity: 60 }] }, ctx(warehouse, clock)));
    expect(error.code).toBe("insufficient_availability");

    // Once the morning event releases its reservation the early dispatch fits.
    ({ state } = unwrap(releaseRemaining(state, { eventId: morning }, ctx(coordinator, clock))));
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId: lateLine, quantity: 60 }] }, ctx(warehouse, clock))));
    expect(lineOf(state, eventId, articleId).windowStart).toBe(clock.now());
  });
});

describe("Returns and washing (R5, R6, R9)", () => {
  function dispatched(quantity: number) {
    const clock = new TestClock(lima("2026-11-28T09:30"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity }] }));
    const lineId = lineOf(state, eventId, articleId).id;
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId, quantity }] }, ctx(warehouse, clock))));
    return { state, articleId, eventId, lineId, clock };
  }

  it("requires a reason for broken and lost units", () => {
    const { state, eventId, lineId, clock } = dispatched(10);
    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId, broken: 1 }] }, ctx(warehouse, clock))).code).toBe("reason_required");
    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId, lost: 1, lostReason: "   " }] }, ctx(warehouse, clock))).code).toBe("reason_required");
    const ok = unwrap(registerReturn(state, { eventId, lines: [{ lineId, broken: 1, brokenReason: "Dropped while unloading" }] }, ctx(warehouse, clock)));
    expect(ok.state.movements.at(-1)?.lines[0]).toMatchObject({ from: "out", to: "broken", quantity: 1, reason: "Dropped while unloading" });
  });

  it("accepts only positive whole quantities", () => {
    const { state, eventId, lineId, clock } = dispatched(10);
    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId, good: 1.5 }] }, ctx(warehouse, clock))).code).toBe("invalid_quantity");
    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId, good: -2 }] }, ctx(warehouse, clock))).code).toBe("invalid_quantity");
    expect(expectError(registerReturn(state, { eventId, lines: [{ lineId }] }, ctx(warehouse, clock))).code).toBe("nothing_to_register");
  });

  it("keeps washing units blocked until their release and links the batch to the return", () => {
    let { state, articleId, eventId, lineId, clock } = dispatched(10);
    const window = { from: lima("2026-11-28T21:00"), to: lima("2026-11-28T23:00") };
    let movementId: string;
    ({ state, value: { movementId } } = unwrap(registerReturn(state, { eventId, lines: [{ lineId, good: 6, washing: 4 }] }, ctx(warehouse, clock))));
    expect(state.stock[articleId]).toEqual({ available: 96, washing: 4, out: 0 });
    expect(availabilityFor(state, articleId, window, clock.now()).available).toBe(96);
    const batch = state.batches.find((b) => b.eventId === eventId);
    expect(batch).toMatchObject({ quantity: 4, sourceMovementId: movementId, purpose: "washing" });

    expect(expectError(releaseWashing(state, { batchId: batch!.id, quantity: 5 }, ctx(warehouse, clock))).code).toBe("batch_exceeded");
    ({ state } = unwrap(releaseWashing(state, { batchId: batch!.id, quantity: 4 }, ctx(warehouse, clock))));
    expect(state.stock[articleId]).toEqual({ available: 100, washing: 0, out: 0 });
    expect(availabilityFor(state, articleId, window, clock.now()).available).toBe(100);
  });

  it("closes only when the pending return is zero; washing continues under the warehouse", () => {
    let { state, articleId, eventId, lineId, clock } = dispatched(10);
    ({ state } = unwrap(registerReturn(state, { eventId, lines: [{ lineId, good: 8 }] }, ctx(warehouse, clock))));
    const blocked = expectError(closeEvent(state, { eventId }, ctx(coordinator, clock)));
    expect(blocked.closeBlockers).toEqual([{ lineId, articleId, toDispatch: 0, pendingReturn: 2 }]);
    ({ state } = unwrap(registerReturn(state, { eventId, lines: [{ lineId, washing: 2 }] }, ctx(warehouse, clock))));
    ({ state } = unwrap(closeEvent(state, { eventId, note: "All back" }, ctx(coordinator, clock))));
    expect(state.events[0]).toMatchObject({ status: "closed", closeNote: "All back" });
    expect(state.stock[articleId]?.washing).toBe(2);
  });
});

describe("Inventory (design §6.4) and ledger (R8)", () => {
  it("rejects a duplicate SKU and a second opening balance", () => {
    const clock = new TestClock(lima("2026-11-20T09:00"));
    const { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP-01", name: "Cup", available: 10 });
    expect(expectError(createArticle(state, { sku: "cup-01", name: "Other", category: "X", kind: "returnable" }, ctx(admin, clock))).code).toBe("duplicate_sku");
    expect(expectError(registerOpening(state, { articleId, available: 5, washing: 0 }, ctx(admin, clock))).code).toBe("opening_exists");
  });

  it("every adjustment requires a reason, and a negative adjustment that leaves an event short needs explicit acceptance", () => {
    const clock = new TestClock(lima("2026-11-25T09:00"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "E", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 95 }] }));
    expect(expectError(adjustStock(state, { articleId, delta: -10, reason: "" }, ctx(admin, clock))).code).toBe("reason_required");
    const shortage = expectError(adjustStock(state, { articleId, delta: -10, reason: "Broken in storage" }, ctx(admin, clock)));
    expect(shortage.code).toBe("creates_shortage");
    expect(shortage.affectedEvents).toEqual([{ eventId, articleId, missing: 5 }]);
    const accepted = unwrap(adjustStock(state, { articleId, delta: -10, reason: "Broken in storage", acceptShortage: true }, ctx(admin, clock)));
    expect(accepted.state.stock[articleId]?.available).toBe(90);
    expect(accepted.state.movements.at(-1)).toMatchObject({ kind: "adjustment", reason: "Broken in storage", acceptShortage: true });
  });

  it("registers a receipt and keeps user, time, article, quantity, reason and event in the ledger", () => {
    const clock = new TestClock(lima("2026-11-28T09:30"));
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 10 });
    ({ state } = unwrap(registerReceipt(state, { articleId, quantity: 15, note: "Supplier delivery" }, ctx(warehouse, clock))));
    expect(state.stock[articleId]?.available).toBe(25);
    let eventId: string;
    ({ state, eventId } = addConfirmed(state, clock, { name: "Gala", from: "2026-11-28T09:00", to: "2026-11-28T20:00", lines: [{ articleId, quantity: 5 }] }));
    ({ state } = unwrap(dispatchEvent(state, { eventId, lines: [{ lineId: lineOf(state, eventId, articleId).id, quantity: 5 }] }, ctx(warehouse, clock))));

    const ledger = listLedger(state, { articleId });
    expect(ledger.map((entry) => entry.kind)).toEqual(["dispatch", "receipt", "opening"]);
    expect(ledger[0]).toMatchObject({
      recordedBy: { id: warehouse.id, name: warehouse.name },
      occurredAt: clock.now(),
      articleId,
      quantity: 5,
      from: "available",
      to: "out",
      eventId,
      eventName: "Gala",
      locationName: "Main warehouse",
    });
    expect(ledger[1]).toMatchObject({ kind: "receipt", quantity: 15, reason: "Supplier delivery" });
  });
});
