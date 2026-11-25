import {
  closeEvent,
  confirmEvent,
  createArticle,
  createDraft,
  createEmptyState,
  dispatchEvent,
  registerOpening,
  registerReceipt,
  registerReturn,
  type Actor,
  type ArticleKind,
  type CommandContext,
  type CommandResult,
  type InventoryState,
  type Role,
} from "@/domain";
import { addDays, fromLima, MINUTE_MS, nextSaturdayAfter } from "@/lib/lima-time";

/** Fictional company used by the demo. Every name and number here is invented. */
export const DEMO_COMPANY = {
  id: "co-demo",
  name: "Valtiera Banquetes",
  locationId: "loc-main",
  locationName: "Almacén principal",
} as const;

export const DEMO_USERS: Record<Role, Actor> = {
  admin: { id: "u-admin", name: "Mariela Torrico", roles: ["admin"] },
  coordinator: { id: "u-coord", name: "Joaquín Ríos", roles: ["coordinator"] },
  warehouse: { id: "u-wh", name: "Elena Huamán", roles: ["warehouse"] },
};

export interface DemoRefs {
  /** Lima date of the fictional Saturday (YYYY-MM-DD). */
  saturday: string;
  lunchId: string;
  weddingId: string;
  dinnerId: string;
  cocktailId: string;
  cupsId: string;
  platesId: string;
  coversId: string;
  tableclothsId: string;
  disposableId: string;
}

export interface DemoScenario {
  state: InventoryState;
  refs: DemoRefs;
  seededAt: number;
}

class SeedClock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  at(epoch: number): this {
    this.current = epoch;
    return this;
  }
}

function must<T>(result: CommandResult<T>, step: string): { state: InventoryState; value: T } {
  if (!result.ok) throw new Error(`Demo seed failed at ${step}: ${result.error.code}`);
  return { state: result.state, value: result.value };
}

/**
 * Builds the scenario of spec §5 through the domain commands, so the seed obeys the same rules
 * as the screens. Dates anchor to the first Saturday strictly after the start instant in Lima,
 * so the script always starts before the events, even when the demo is reset on a Saturday.
 */
export function createDemoScenario(startAt: number): DemoScenario {
  const saturday = nextSaturdayAfter(startAt);
  const sunday = addDays(saturday, 1);
  const monday = addDays(saturday, 2);
  const pastFriday = addDays(saturday, -8);
  const clock = new SeedClock(startAt);
  const as = (role: Role, at: number): CommandContext => ({ actor: DEMO_USERS[role], clock: clock.at(at) });

  let state = createEmptyState({ companyId: DEMO_COMPANY.id, locationId: DEMO_COMPANY.locationId, locationName: DEMO_COMPANY.locationName });

  const openingAt = fromLima(addDays(saturday, -10), "09:00");
  const catalog: { key: keyof DemoRefs; sku: string; name: string; category: string; kind: ArticleKind; available: number; washing: number }[] = [
    { key: "cupsId", sku: "COP-VIN-01", name: "Copa de vino", category: "Cristalería", kind: "returnable", available: 270, washing: 30 },
    { key: "platesId", sku: "PLA-LLA-27", name: "Plato llano de 27 cm", category: "Vajilla", kind: "returnable", available: 360, washing: 0 },
    { key: "coversId", sku: "FUN-SIL-BL", name: "Funda para silla, blanca", category: "Mantelería", kind: "returnable", available: 250, washing: 0 },
    { key: "tableclothsId", sku: "MAN-RED-BE", name: "Mantel redondo, beige", category: "Mantelería", kind: "returnable", available: 60, washing: 0 },
    { key: "disposableId", sku: "VAS-DES-12", name: "Vaso descartable de 12 oz", category: "Descartables", kind: "consumable", available: 1000, washing: 0 },
  ];
  const ids: Partial<Record<keyof DemoRefs, string>> = {};
  for (const item of catalog) {
    const created = must(createArticle(state, item, as("admin", openingAt)), `article ${item.sku}`);
    state = created.state;
    ids[item.key] = created.value.articleId;
    state = must(
      registerOpening(state, { articleId: created.value.articleId, available: item.available, washing: item.washing }, as("admin", openingAt + MINUTE_MS)),
      `opening ${item.sku}`,
    ).state;
  }
  const article = (key: keyof DemoRefs) => ids[key] as string;

  state = must(
    registerReceipt(state, { articleId: article("platesId"), quantity: 40, note: "Compra de reposición" }, as("warehouse", fromLima(addDays(saturday, -9), "11:20"))),
    "plates receipt",
  ).state;

  // A closed event from the previous week gives the history and the washing list some depth.
  const cocktail = must(
    createDraft(
      state,
      {
        name: "Cóctel de lanzamiento",
        customer: "Atelier Cobre Arquitectos",
        venue: "Terraza Mirador, Miraflores",
        departureAt: fromLima(pastFriday, "15:00"),
        readyAt: fromLima(addDays(pastFriday, 1), "12:00"),
        lines: [
          { articleId: article("coversId"), quantity: 60 },
          { articleId: article("tableclothsId"), quantity: 12 },
          { articleId: article("disposableId"), quantity: 120 },
        ],
      },
      as("coordinator", fromLima(addDays(pastFriday, -2), "10:15")),
    ),
    "cocktail draft",
  );
  state = cocktail.state;
  const cocktailId = cocktail.value.eventId;
  state = must(confirmEvent(state, { eventId: cocktailId }, as("coordinator", fromLima(addDays(pastFriday, -2), "10:40"))), "cocktail confirm").state;
  const cocktailLines = state.events.find((e) => e.id === cocktailId)!.lines;
  const lineFor = (articleId: string) => cocktailLines.find((l) => l.articleId === articleId)!.id;
  state = must(
    dispatchEvent(
      state,
      { eventId: cocktailId, lines: cocktailLines.map((l) => ({ lineId: l.id, quantity: l.requestedQty })) },
      as("warehouse", fromLima(pastFriday, "15:05")),
    ),
    "cocktail dispatch",
  ).state;
  state = must(
    registerReturn(
      state,
      {
        eventId: cocktailId,
        lines: [
          { lineId: lineFor(article("coversId")), good: 54, washing: 6 },
          { lineId: lineFor(article("tableclothsId")), washing: 12 },
        ],
      },
      as("warehouse", fromLima(pastFriday, "23:30")),
    ),
    "cocktail return",
  ).state;
  state = must(closeEvent(state, { eventId: cocktailId, note: "Sin novedades" }, as("coordinator", fromLima(pastFriday, "23:45"))), "cocktail close").state;

  // The fictional Saturday: a confirmed corporate lunch and a wedding still in draft.
  const lunch = must(
    createDraft(
      state,
      {
        name: "Almuerzo corporativo",
        customer: "Consultora Nazca Verde",
        venue: "Auditorio Los Laureles, San Isidro",
        departureAt: fromLima(saturday, "08:30"),
        readyAt: fromLima(saturday, "18:00"),
        lines: [
          { articleId: article("cupsId"), quantity: 180 },
          { articleId: article("platesId"), quantity: 180 },
          { articleId: article("coversId"), quantity: 180 },
          { articleId: article("tableclothsId"), quantity: 18 },
          { articleId: article("disposableId"), quantity: 150 },
        ],
      },
      as("coordinator", startAt - 20 * MINUTE_MS),
    ),
    "lunch draft",
  );
  state = must(confirmEvent(lunch.state, { eventId: lunch.value.eventId }, as("coordinator", startAt - 18 * MINUTE_MS)), "lunch confirm").state;

  const dinner = must(
    createDraft(
      state,
      {
        name: "Cena de aniversario",
        customer: "Familia Ugarte Salas",
        venue: "Club Los Ficus, La Molina",
        departureAt: fromLima(sunday, "15:00"),
        readyAt: fromLima(monday, "11:00"),
        lines: [
          { articleId: article("cupsId"), quantity: 200 },
          { articleId: article("platesId"), quantity: 200 },
        ],
      },
      as("coordinator", startAt - 12 * MINUTE_MS),
    ),
    "dinner draft",
  );
  state = must(confirmEvent(dinner.state, { eventId: dinner.value.eventId }, as("coordinator", startAt - 10 * MINUTE_MS)), "dinner confirm").state;

  const wedding = must(
    createDraft(
      state,
      {
        name: "Boda de Camila y Andrés",
        customer: "Camila Rivas",
        venue: "Quinta Las Vilcas, Pachacámac",
        departureAt: fromLima(saturday, "14:00"),
        readyAt: fromLima(sunday, "12:00"),
        lines: [
          { articleId: article("cupsId"), quantity: 100 },
          { articleId: article("disposableId"), quantity: 50 },
        ],
      },
      as("coordinator", startAt - 5 * MINUTE_MS),
    ),
    "wedding draft",
  );
  state = wedding.state;

  return {
    state,
    seededAt: startAt,
    refs: {
      saturday,
      lunchId: lunch.value.eventId,
      weddingId: wedding.value.eventId,
      dinnerId: dinner.value.eventId,
      cocktailId,
      cupsId: article("cupsId"),
      platesId: article("platesId"),
      coversId: article("coversId"),
      tableclothsId: article("tableclothsId"),
      disposableId: article("disposableId"),
    },
  };
}
