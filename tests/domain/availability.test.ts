import { describe, expect, it } from "vitest";
import { availabilityFor, peakCommitment } from "@/domain";
import { addArticle, addConfirmed, addDraft, emptyState, lima, TestClock } from "./helpers";

describe("peakCommitment (sweep over half-open windows)", () => {
  it("processes ends before starts so back-to-back windows reuse the same units", () => {
    const peak = peakCommitment(
      [
        { start: lima("2026-11-28T10:00"), end: lima("2026-11-28T14:00"), quantity: 40 },
        { start: lima("2026-11-28T14:00"), end: lima("2026-11-28T20:00"), quantity: 40 },
      ],
      lima("2026-11-28T08:00"),
      lima("2026-11-28T22:00"),
    );
    expect(peak).toBe(40);
  });

  it("adds commitments that truly overlap", () => {
    const peak = peakCommitment(
      [
        { start: lima("2026-11-28T10:00"), end: lima("2026-11-28T15:00"), quantity: 40 },
        { start: lima("2026-11-28T14:00"), end: lima("2026-11-28T20:00"), quantity: 40 },
      ],
      lima("2026-11-28T08:00"),
      lima("2026-11-28T22:00"),
    );
    expect(peak).toBe(80);
  });

  it("ignores commitments outside the requested window and supports open-ended windows", () => {
    const peak = peakCommitment(
      [
        { start: lima("2026-11-27T10:00"), end: lima("2026-11-28T08:00"), quantity: 70 },
        { start: lima("2026-11-28T09:00"), end: Number.POSITIVE_INFINITY, quantity: 25 },
      ],
      lima("2026-11-28T08:00"),
      lima("2026-11-28T22:00"),
    );
    expect(peak).toBe(25);
  });

  it("returns zero for an empty window", () => {
    expect(peakCommitment([{ start: 0, end: 10, quantity: 5 }], 10, 10)).toBe(0);
  });
});

describe("availability formula: physical - washing - overdue - peak(W)", () => {
  const clock = new TestClock(lima("2026-11-25T09:00"));

  it("drafts do not commit stock (R1)", () => {
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    ({ state } = addDraft(state, clock, {
      name: "Draft",
      from: "2026-11-28T10:00",
      to: "2026-11-28T18:00",
      lines: [{ articleId, quantity: 80 }],
    }));
    const result = availabilityFor(state, articleId, { from: lima("2026-11-28T09:00"), to: lima("2026-11-28T20:00") }, clock.now());
    expect(result.available).toBe(100);
  });

  it("units in washing stay blocked without a date (R6)", () => {
    const { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 270, washing: 30 });
    const result = availabilityFor(state, articleId, { from: lima("2026-11-28T09:00"), to: lima("2026-11-28T20:00") }, clock.now());
    expect(result).toMatchObject({ physical: 300, washing: 30, overdue: 0, peak: 0, available: 270 });
  });

  it("a confirmed reservation commits units only inside its window", () => {
    let { state, articleId } = addArticle(emptyState(), clock, { sku: "CUP", name: "Cup", available: 100 });
    ({ state } = addConfirmed(state, clock, {
      name: "Lunch",
      from: "2026-11-28T09:00",
      to: "2026-11-28T18:00",
      lines: [{ articleId, quantity: 60 }],
    }));
    const inside = availabilityFor(state, articleId, { from: lima("2026-11-28T12:00"), to: lima("2026-11-28T13:00") }, clock.now());
    const after = availabilityFor(state, articleId, { from: lima("2026-11-28T18:00"), to: lima("2026-11-28T23:00") }, clock.now());
    expect(inside.available).toBe(40);
    expect(after.available).toBe(100);
  });
});
