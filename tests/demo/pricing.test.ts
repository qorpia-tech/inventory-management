import { describe, expect, it } from "vitest";
import {
  advanceFor,
  annualEquivalent,
  annualPrice,
  formatSoles,
  hiringSteps,
  implementationWithInvoicing,
  type Plan,
  PRICING,
  quote,
  startCost,
  upgradeDifference,
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
    expect(PRICING.plans.map((p) => p.implementation.from)).toEqual([1300, 1800]);
    expect(PRICING.implementation.invoicing).toMatchObject({ surcharge: 2500, providerMonthly: 70 });
    expect([PRICING.website.creation.from, PRICING.website.hosting.monthly]).toEqual([950, 60]);
    expect(PRICING.advance).toMatchObject({ rate: 0.3, minimum: 500 });
  });

  it("computes the derived totals instead of hard-coding them", () => {
    const [inventory, events] = PRICING.plans as [Plan, Plan];
    expect([implementationWithInvoicing(inventory), implementationWithInvoicing(events)]).toEqual([3800, 4300]);
    expect(upgradeDifference()).toBe(500);
    expect(annualPrice(360)).toBe(3600);
  });

  it("computes the advance: 30% of one-time payments with a minimum of S/ 500", () => {
    expect(advanceFor(1800)).toEqual({ total: 1800, advance: 540, balance: 1260, isMinimum: false });
    expect(advanceFor(950)).toEqual({ total: 950, advance: 500, balance: 450, isMinimum: true });
    expect(advanceFor(1300)).toEqual({ total: 1300, advance: 500, balance: 800, isMinimum: true });
  });

  it("states that every plan starts with the one-time implementation plus the first payment", () => {
    expect(PRICING.plans.map((p) => startCost(p))).toEqual([
      { implementation: 1300, firstPayment: 180, total: 1480 },
      { implementation: 1800, firstPayment: 360, total: 2160 },
    ]);
    expect(PRICING.plans.map((p) => startCost(p, "annual"))).toEqual([
      { implementation: 1300, firstPayment: 1800, total: 3100 },
      { implementation: 1800, firstPayment: 3600, total: 5400 },
    ]);
  });

  it("shows the annual price as its monthly equivalent", () => {
    expect(PRICING.plans.map((p) => annualEquivalent(p.monthly))).toEqual([150, 300]);
  });

  describe("quote calculator", () => {
    const base = { plan: "inventario-eventos", staff: false, users: 5, invoicing: false, website: false, billing: "monthly", newClient: false } as const;

    it("prices the recommended plan alone like the first-year example", () => {
      const q = quote(base);
      expect([q.oneTimeTotal, q.advance.advance, q.advance.balance, q.monthlyTotal, q.subscriptions, q.firstYear]).toEqual([
        1800, 540, 1260, 360, 4320, 6120,
      ]);
      expect(quote({ ...base, billing: "annual" }).firstYear).toBe(5400);
      expect(q.providerMonthly).toBe(0);
    });

    it("adds everything a client can pick, with the advance on all one-time payments", () => {
      const q = quote({ ...base, staff: true, users: 7, invoicing: true, website: true, billing: "annual" });
      expect(q.oneTime.map((l) => l.amount)).toEqual([1800, 2500, 950]);
      expect(q.oneTimeTotal).toBe(5250);
      expect(q.advance).toEqual({ total: 5250, advance: 1575, balance: 3675, isMinimum: false });
      expect(q.monthly.map((l) => l.amount)).toEqual([360, 100, 40, 60]);
      expect(q.monthlyTotal).toBe(560);
      expect(q.subscriptions).toBe(5600);
      expect(q.firstYear).toBe(10850);
      expect(q.providerMonthly).toBe(70);
    });

    it("prices the website alone and ignores options that need a plan", () => {
      const q = quote({ ...base, plan: "web", staff: true, users: 9, invoicing: true });
      expect([q.oneTimeTotal, q.advance.advance, q.advance.balance, q.monthlyTotal, q.firstYear]).toEqual([950, 500, 450, 60, 1670]);
      expect(q.applied).toEqual({ staff: false, invoicing: false, website: true, extraUsers: 0, welcome: false });
      expect(q.providerMonthly).toBe(0);
    });

    it("gives a new client on the monthly plan month 4 free, once, on the whole monthly fee", () => {
      const q = quote({ ...base, newClient: true });
      expect([q.welcome, q.subscriptions, q.firstYear]).toEqual([360, 3960, 5760]);
      expect(q.applied.welcome).toBe(true);
      const full = quote({ ...base, newClient: true, staff: true, users: 7, invoicing: true, website: true });
      expect([full.monthlyTotal, full.welcome, full.subscriptions, full.firstYear]).toEqual([560, 560, 6160, 11410]);
    });

    it("does not stack the welcome month with the annual discount or give it to the website alone", () => {
      const annual = quote({ ...base, newClient: true, billing: "annual" });
      expect([annual.welcome, annual.subscriptions, annual.firstYear, annual.applied.welcome]).toEqual([0, 3600, 5400, false]);
      const webOnly = quote({ ...base, plan: "web", newClient: true });
      expect([webOnly.welcome, webOnly.firstYear, webOnly.applied.welcome]).toEqual([0, 1670, false]);
    });

    it("reads the cost per month: the annual comparison and the first year spread over twelve months", () => {
      const inventory = quote({ ...base, plan: "inventario", newClient: true });
      expect([inventory.monthlyTotal, inventory.annual.total, inventory.annual.perMonth]).toEqual([180, 1800, 150]);
      expect([inventory.firstYear, inventory.firstYearPerMonth]).toEqual([3280, 274]);
      expect(quote({ ...base, plan: "inventario" }).firstYearPerMonth).toBe(289);
      expect(quote({ ...base, billing: "annual" }).firstYearPerMonth).toBe(450);
      const full = quote({ ...base, newClient: true, staff: true, users: 7, invoicing: true, website: true });
      expect([full.firstYear, full.firstYearPerMonth]).toEqual([11410, 951]);
    });

    it("does not add staff to the inventory-only plan", () => {
      const q = quote({ ...base, plan: "inventario", staff: true });
      expect(q.monthlyTotal).toBe(180);
      expect(q.applied.staff).toBe(false);
    });
  });

  it("does not publish the pilot discount: it is offered only in the first client's proposal", () => {
    expect(PRICING.conditions.map((c) => c.title)).toEqual(["Pago anual", "Bienvenida", "Descuentos", "Facturación"]);
    expect(JSON.stringify(PRICING)).not.toMatch(/piloto/i);
  });

  it("explains how to hire, in order, with the advance computed from the implementation", () => {
    const steps = hiringSteps();
    expect(steps.map((s) => s.title)).toEqual(["Firma y anticipo", "Implementación", "Mensualidad"]);
    expect(steps[0]!.text).toContain(formatSoles(500));
  });
});
