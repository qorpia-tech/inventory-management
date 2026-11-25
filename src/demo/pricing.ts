/**
 * Public QorStock prices for the catering client. Every amount lives here so it changes in one
 * place; derived totals are computed, never typed by hand. Soles, IGV included, per company.
 */
export interface Plan {
  id: string;
  name: string;
  monthly: number;
  includes: string;
  users: number;
  recommended?: boolean;
}

export interface PricingData {
  plans: Plan[];
  addons: {
    staff: { name: string; monthly: number; condition: string };
    extraUser: { name: string; monthlyPerUser: number; condition: string };
  };
  implementation: {
    base: { name: string; from: number; includes: string };
    invoicing: { name: string; surcharge: number; includes: string; providerMonthly: number; providerName: string };
  };
  website: {
    creation: { name: string; from: number; includes: string };
    hosting: { name: string; monthly: number; includes: string };
  };
  advance: { rate: number; minimum: number; lead: string; covers: string[]; excludes: string[] };
  annualFreeMonths: number;
  pilotDiscount: number;
  conditions: { title: string; text: string }[];
  exampleFootnote: string;
  taxNote: string;
}

export const PRICING: PricingData = {
  plans: [
    {
      id: "inventario",
      name: "Inventario",
      monthly: 180,
      includes: "Catálogo, existencias por almacén, movimientos e historial.",
      users: 5,
    },
    {
      id: "inventario-eventos",
      name: "Inventario + Eventos",
      monthly: 360,
      includes:
        "Todo Inventario, más disponibilidad por horario, reservas, despacho y devolución desde el celular, lavado y alertas de atraso.",
      users: 5,
      recommended: true,
    },
  ],
  addons: {
    staff: {
      name: "Personal y asistencia",
      monthly: 100,
      condition: "Convocatoria y registro de llegada por evento. Requiere el plan Inventario + Eventos.",
    },
    extraUser: {
      name: "Usuario adicional",
      monthlyPerUser: 20,
      condition: "Desde el sexto usuario, en cualquier plan. El personal convocado no necesita cuenta de usuario.",
    },
  },
  implementation: {
    base: {
      name: "Base",
      from: 1800,
      includes:
        "Carga de hasta 300 artículos en un almacén, configuración de usuarios, capacitación del equipo y acompañamiento del primer evento. Un catálogo más grande o más almacenes se cotiza.",
    },
    invoicing: {
      name: "Con facturación electrónica (Nubefact)",
      surcharge: 2500,
      includes: "Emite facturas y boletas de tus eventos desde QorStock. La cuenta de Nubefact se contrata aparte, a nombre de tu empresa",
      providerMonthly: 70,
      providerName: "Nubefact",
    },
  },
  website: {
    creation: {
      name: "Creación",
      from: 950,
      includes: "Una página con hasta 6 servicios con fotos y consulta por WhatsApp. Más servicios se cotizan.",
    },
    hosting: { name: "Hosting y mantenimiento", monthly: 60, includes: "Se contrata con o sin un plan de QorStock." },
  },
  advance: {
    rate: 0.3,
    minimum: 500,
    lead: "Al firmar pagas un anticipo del 30% de los pagos únicos (implementación y creación de la web), con un mínimo de S/ 500. Se descuenta del total y el saldo se paga a la entrega.",
    covers: [
      "Reserva de la fecha de inicio.",
      "Reunión de arranque y plantilla para cargar tu catálogo.",
      "Alta de tu empresa, almacén y usuarios.",
      "Inicio de la carga del catálogo.",
    ],
    excludes: [
      "Las mensualidades: empiezan con la puesta en marcha y se pagan al inicio de cada mes.",
      "El saldo de la implementación o de la web, que se paga a la entrega.",
      "La cuenta de Nubefact.",
      "Catálogos de más de 300 artículos, más almacenes o cambios fuera del alcance acordado: se cotizan aparte.",
    ],
  },
  annualFreeMonths: 2,
  pilotDiscount: 0.3,
  conditions: [
    { title: "Pago anual", text: "2 meses gratis en todas las mensualidades (planes, adicionales y mantenimiento de la web)." },
    { title: "Piloto", text: "30% de descuento en la implementación base. No aplica al recargo de facturación." },
    {
      title: "Descuentos",
      text: "el piloto se aplica a la implementación base y el pago anual a las mensualidades; no se suman otros descuentos.",
    },
    { title: "Facturación", text: "funciona junto con tu sistema de facturación actual, o conéctalo con Nubefact." },
  ],
  exampleFootnote: "Calculado con el precio «desde» de la implementación; el monto final depende del catálogo.",
  taxNote: "Precios en soles, IGV incluido, por empresa.",
};

const soles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const NO_BREAK_SPACE = String.fromCharCode(160);

/** «S/ 1,800». The space after S/ does not break, so the amount never wraps apart from its symbol. */
export function formatSoles(amount: number): string {
  return soles.format(amount).replace(/\s/g, NO_BREAK_SPACE);
}

export function monthsPaidPerYear(data: PricingData = PRICING): number {
  return 12 - data.annualFreeMonths;
}

/** Yearly price paid in advance: the free months are discounted. */
export function annualPrice(monthly: number, data: PricingData = PRICING): number {
  return monthly * monthsPaidPerYear(data);
}

export function implementationWithInvoicing(data: PricingData = PRICING): number {
  return data.implementation.base.from + data.implementation.invoicing.surcharge;
}

/** Pilot discount applies to the base implementation only. */
export function pilotImplementation(data: PricingData = PRICING): number {
  return Math.round(data.implementation.base.from * (1 - data.pilotDiscount));
}

export interface AdvanceSplit {
  total: number;
  advance: number;
  balance: number;
  isMinimum: boolean;
}

export function advanceFor(total: number, data: PricingData = PRICING): AdvanceSplit {
  const proportional = Math.round(total * data.advance.rate);
  const advance = Math.min(total, Math.max(data.advance.minimum, proportional));
  return { total, advance, balance: total - advance, isMinimum: advance > proportional };
}

export interface FirstYearRow {
  label: string;
  implementation: number;
  months: number;
  monthly: number;
  subscriptions: number;
  total: number;
  /** When true, the subscriptions column shows only the amount, without the multiplication. */
  compact?: boolean;
}

/** «Ejemplo: Inventario + Eventos, primer año» */
export function firstYearExample(data: PricingData = PRICING): FirstYearRow[] {
  const plan = data.plans.find((p) => p.recommended) ?? data.plans[0]!;
  const base = data.implementation.base.from;
  const paidMonths = monthsPaidPerYear(data);
  const pilot = pilotImplementation(data);
  return [
    { label: "Mensual", implementation: base, months: 12, monthly: plan.monthly, subscriptions: 12 * plan.monthly, total: base + 12 * plan.monthly },
    {
      label: "Anual",
      implementation: base,
      months: paidMonths,
      monthly: plan.monthly,
      subscriptions: paidMonths * plan.monthly,
      total: base + paidMonths * plan.monthly,
    },
    {
      label: "Anual, con descuento del piloto",
      implementation: pilot,
      months: paidMonths,
      monthly: plan.monthly,
      subscriptions: paidMonths * plan.monthly,
      total: pilot + paidMonths * plan.monthly,
      compact: true,
    },
  ];
}
