import { describe, expect, it } from "vitest";
import {
  advanceFor,
  annualPrice,
  formatSoles,
  hiringSteps,
  implementationWithInvoicing,
  pilotImplementation,
  PRICING,
  quote,
  startCost,
} from "@/demo/pricing";

/** Amounts use a no-break space after S/; compare them as they read. */
const plain = (amount: number) => formatSoles(amount).split(String.fromCharCode(160)).join(" ");

describe("QorStock public pricing (part A)", () => {
  it("formats soles the way they read in Peru", () => {
    expect(plain(180)).toBe("S/ 180");
    expect(plain(1800)).toBe("S/ 1,800");
    expect(formatSoles(180)).toBe(`S/${String.fromCharCode(160)}180`);
  });

  it("keeps the agreed base figures", () => {
    expect(PRICING.plans.map((p) => [p.name, p.monthly, p.users])).toEqual([
      ["Inventario", 180, 5],
      ["Inventario + Eventos", 360, 5],
    ]);
    expect(PRICING.plans.find((p) => p.recommended)?.name).toBe("Inventario + Eventos");
    expect(PRICING.addons.staff.monthly).toBe(100);
    expect(PRICING.addons.extraUser.monthlyPerUser).toBe(20);
    expect(PRICING.implementation.base.from).toBe(1800);
    expect(PRICING.implementation.invoicing).toMatchObject({ surcharge: 2500, providerMonthly: 70 });
    expect([PRICING.website.creation.from, PRICING.website.hosting.monthly]).toEqual([950, 60]);
    expect(PRICING.advance).toMatchObject({ rate: 0.3, minimum: 500 });
  });

  it("computes the derived totals instead of hard-coding them", () => {
    expect(implementationWithInvoicing()).toBe(4300);
    expect(annualPrice(360)).toBe(3600);
    expect(pilotImplementation()).toBe(1260);
  });

  it("computes the advance: 30% of one-time payments with a minimum of S/ 500", () => {
    expect(advanceFor(1800)).toEqual({ total: 1800, advance: 540, balance: 1260, isMinimum: false });
    expect(advanceFor(950)).toEqual({ total: 950, advance: 500, balance: 450, isMinimum: true });
  });

  it("states that every plan starts with the one-time implementation plus the first month", () => {
    expect(PRICING.plans.map((p) => startCost(p))).toEqual([
      { implementation: 1800, firstMonth: 180, total: 1980 },
      { implementation: 1800, firstMonth: 360, total: 2160 },
    ]);
  });

  describe("quote calculator", () => {
    const base = { plan: "inventario-eventos", staff: false, users: 5, invoicing: false, website: false, billing: "monthly", pilot: false } as const;

    it("prices the recommended plan alone like the first-year example", () => {
      const q = quote(base);
      expect([q.oneTimeTotal, q.advance.advance, q.advance.balance, q.monthlyTotal, q.subscriptions, q.firstYear]).toEqual([
        1800, 540, 1260, 360, 4320, 6120,
      ]);
      expect(quote({ ...base, billing: "annual" }).firstYear).toBe(5400);
      expect(quote({ ...base, billing: "annual", pilot: true }).firstYear).toBe(4860);
      expect(q.providerMonthly).toBe(0);
    });

    it("adds everything a client can pick, with the advance on all one-time payments", () => {
      const q = quote({ ...base, staff: true, users: 7, invoicing: true, website: true, billing: "annual", pilot: true });
      expect(q.oneTime.map((l) => l.amount)).toEqual([1260, 2500, 950]);
      expect(q.oneTimeTotal).toBe(4710);
      expect(q.advance).toEqual({ total: 4710, advance: 1413, balance: 3297, isMinimum: false });
      expect(q.monthly.map((l) => l.amount)).toEqual([360, 100, 40, 60]);
      expect(q.monthlyTotal).toBe(560);
      expect(q.subscriptions).toBe(5600);
      expect(q.firstYear).toBe(10310);
      expect(q.providerMonthly).toBe(70);
    });

    it("prices the website alone and ignores options that need a plan", () => {
      const q = quote({ ...base, plan: "web", staff: true, users: 9, invoicing: true, pilot: true });
      expect([q.oneTimeTotal, q.advance.advance, q.advance.balance, q.monthlyTotal, q.firstYear]).toEqual([950, 500, 450, 60, 1670]);
      expect(q.applied).toEqual({ staff: false, invoicing: false, website: true, pilot: false, extraUsers: 0 });
      expect(q.providerMonthly).toBe(0);
    });

    it("does not add staff to the inventory-only plan", () => {
      const q = quote({ ...base, plan: "inventario", staff: true });
      expect(q.monthlyTotal).toBe(180);
      expect(q.applied.staff).toBe(false);
    });
  });

  it("explains how to hire, in order, with the advance computed from the implementation", () => {
    const steps = hiringSteps();
    expect(steps.map((s) => s.title)).toEqual(["Firma y anticipo", "Implementación", "Mensualidad"]);
    expect(steps[0]!.text).toContain(formatSoles(540));
  });
});
