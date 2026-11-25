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
  /** New clients on the monthly plan: this month of the monthly fee is free, once per RUC. */
  welcomeFreeMonth: number;
  pilotDiscount: number;
  conditions: { title: string; text: string }[];
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
  welcomeFreeMonth: 4,
  pilotDiscount: 0.3,
  conditions: [
    { title: "Pago anual", text: "se paga el año por adelantado, con 2 meses gratis en todas las mensualidades (planes, adicionales y mantenimiento de la web)." },
    {
      title: "Bienvenida",
      text: "si es tu primera vez con QorStock y pagas mes a mes, el mes 4 va gratis si estás al día con los tres primeros. Una sola vez por RUC.",
    },
    { title: "Piloto", text: "30% de descuento en la implementación base. No aplica al recargo de facturación." },
    {
      title: "Descuentos",
      text: "el piloto se aplica a la implementación base. La bienvenida y el pago anual se aplican a las mensualidades y no se combinan: si pasas a anual antes del mes 4, la bienvenida no aplica.",
    },
    { title: "Facturación", text: "funciona junto con tu sistema de facturación actual, o conéctalo con Nubefact." },
  ],
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

/** The annual price spread over twelve months, IGV included. */
export function annualEquivalent(monthly: number, data: PricingData = PRICING): number {
  return Math.round(annualPrice(monthly, data) / 12);
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

export interface StartCost {
  implementation: number;
  /** The first month, or the first year when paying annually. */
  firstPayment: number;
  total: number;
}

/** Every plan starts with the one-time base implementation; the fee runs from go-live. */
export function startCost(plan: Plan, billing: Billing = "monthly", data: PricingData = PRICING): StartCost {
  const implementation = data.implementation.base.from;
  const firstPayment = billing === "annual" ? annualPrice(plan.monthly, data) : plan.monthly;
  return { implementation, firstPayment, total: implementation + firstPayment };
}

export interface HiringStep {
  title: string;
  text: string;
}

/** «Cómo se contrata»: the order in which a plan is paid for. */
export function hiringSteps(data: PricingData = PRICING): HiringStep[] {
  const advance = advanceFor(data.implementation.base.from, data).advance;
  return [
    {
      title: "Firma y anticipo",
      text: `Al firmar pagas el anticipo: 30% de la implementación (desde ${formatSoles(advance)}).`,
    },
    {
      title: "Implementación",
      text: "Cargamos tu catálogo, configuramos tus usuarios y capacitamos a tu equipo. El saldo se paga a la entrega.",
    },
    {
      title: "Mensualidad",
      text: "Desde la puesta en marcha pagas el plan elegido: mes a mes, o el año por adelantado con 2 meses gratis.",
    },
  ];
}

export type PlanChoice = "inventario" | "inventario-eventos" | "web";
export type Billing = "monthly" | "annual";

/** What the client picks in «Arma tu plan». */
export interface QuoteSelection {
  plan: PlanChoice;
  staff: boolean;
  /** Total user accounts; the plan includes some and the rest are charged per user. */
  users: number;
  invoicing: boolean;
  website: boolean;
  billing: Billing;
  pilot: boolean;
  /** First time with QorStock: the monthly plan gets the welcome month. */
  newClient: boolean;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  oneTime: QuoteLine[];
  oneTimeTotal: number;
  advance: AdvanceSplit;
  monthly: QuoteLine[];
  monthlyTotal: number;
  /** Monthly fee not charged in the welcome month (0 when it does not apply). */
  welcome: number;
  /** Subscriptions paid in the first year: 12 months minus the welcome month, or the annual price. */
  subscriptions: number;
  firstYear: number;
  /** Paid by the client to the invoicing provider; not part of the totals. */
  providerMonthly: number;
  /** The selection after the rules: staff needs Inventario + Eventos; the website alone takes no plan options. */
  applied: { staff: boolean; invoicing: boolean; website: boolean; pilot: boolean; extraUsers: number; welcome: boolean };
}

/** Prices a selection with the public rules of part A. */
export function quote(selection: QuoteSelection, data: PricingData = PRICING): Quote {
  const plan = selection.plan === "web" ? undefined : data.plans.find((p) => p.id === selection.plan);
  const applied = {
    staff: plan?.id === "inventario-eventos" && selection.staff,
    invoicing: Boolean(plan) && selection.invoicing,
    website: !plan || selection.website,
    pilot: Boolean(plan) && selection.pilot,
    extraUsers: plan ? Math.max(0, Math.floor(selection.users) - plan.users) : 0,
    welcome: Boolean(plan) && selection.newClient && selection.billing === "monthly",
  };

  const oneTime: QuoteLine[] = [];
  const monthly: QuoteLine[] = [];
  if (plan) {
    oneTime.push(
      applied.pilot
        ? { label: "Implementación base, con descuento del piloto", amount: pilotImplementation(data) }
        : { label: "Implementación base", amount: data.implementation.base.from },
    );
    if (applied.invoicing) oneTime.push({ label: "Facturación electrónica (Nubefact)", amount: data.implementation.invoicing.surcharge });
    monthly.push({ label: `Plan ${plan.name}`, amount: plan.monthly });
    if (applied.staff) monthly.push({ label: data.addons.staff.name, amount: data.addons.staff.monthly });
    if (applied.extraUsers > 0) {
      monthly.push({
        label: `${applied.extraUsers} ${applied.extraUsers === 1 ? "usuario adicional" : "usuarios adicionales"}`,
        amount: applied.extraUsers * data.addons.extraUser.monthlyPerUser,
      });
    }
  }
  if (applied.website) {
    oneTime.push({ label: "Creación de la web comercial", amount: data.website.creation.from });
    monthly.push({ label: "Hosting y mantenimiento de la web", amount: data.website.hosting.monthly });
  }

  const sum = (lines: QuoteLine[]) => lines.reduce((total, line) => total + line.amount, 0);
  const oneTimeTotal = sum(oneTime);
  const monthlyTotal = sum(monthly);
  const welcome = applied.welcome ? monthlyTotal : 0;
  const subscriptions = selection.billing === "annual" ? annualPrice(monthlyTotal, data) : 12 * monthlyTotal - welcome;
  return {
    oneTime,
    oneTimeTotal,
    advance: advanceFor(oneTimeTotal, data),
    monthly,
    monthlyTotal,
    welcome,
    subscriptions,
    firstYear: oneTimeTotal + subscriptions,
    providerMonthly: applied.invoicing ? data.implementation.invoicing.providerMonthly : 0,
    applied,
  };
}
