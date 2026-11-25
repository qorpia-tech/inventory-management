import { describe, expect, it } from "vitest";
import {
  advanceFor,
  annualPrice,
  firstYearExample,
  formatSoles,
  implementationWithInvoicing,
  pilotImplementation,
  PRICING,
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
    expect(firstYearExample().map((row) => [row.label, row.implementation, row.subscriptions, row.total])).toEqual([
      ["Mensual", 1800, 4320, 6120],
      ["Anual", 1800, 3600, 5400],
      ["Anual, con descuento del piloto", 1260, 3600, 4860],
    ]);
  });

  it("computes the advance: 30% of one-time payments with a minimum of S/ 500", () => {
    expect(advanceFor(1800)).toEqual({ total: 1800, advance: 540, balance: 1260, isMinimum: false });
    expect(advanceFor(950)).toEqual({ total: 950, advance: 500, balance: 450, isMinimum: true });
  });
});
