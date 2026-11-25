import {
  confirmEvent,
  createArticle,
  createDraft,
  createEmptyState,
  registerOpening,
  type Actor,
  type ArticleKind,
  type CommandContext,
  type CommandResult,
  type InventoryState,
} from "@/domain";

export const admin: Actor = { id: "u-admin", name: "Test Admin", roles: ["admin"] };
export const coordinator: Actor = { id: "u-coord", name: "Test Coordinator", roles: ["coordinator"] };
export const coordinatorB: Actor = { id: "u-coord-b", name: "Second Coordinator", roles: ["coordinator"] };
export const warehouse: Actor = { id: "u-wh", name: "Test Warehouse", roles: ["warehouse"] };

/** Lima has no daylight saving time: UTC-5 all year. */
export function lima(local: string): number {
  return Date.parse(`${local}:00-05:00`);
}

export class TestClock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  set(local: string): void {
    this.current = lima(local);
  }
}

export function ctx(actor: Actor, clock: TestClock): CommandContext {
  return { actor, clock };
}

export function unwrap<T>(result: CommandResult<T>): { state: InventoryState; value: T } {
  if (!result.ok) {
    throw new Error(`Expected success, got ${JSON.stringify(result.error)}`);
  }
  return { state: result.state, value: result.value };
}

export function expectError<T>(result: CommandResult<T>) {
  if (result.ok) {
    throw new Error("Expected an error, got success");
  }
  return result.error;
}

export function emptyState(): InventoryState {
  return createEmptyState({ companyId: "co-test", locationId: "loc-main", locationName: "Main warehouse" });
}

export function addArticle(
  state: InventoryState,
  clock: TestClock,
  input: { sku: string; name: string; kind?: ArticleKind; available: number; washing?: number },
): { state: InventoryState; articleId: string } {
  const created = unwrap(
    createArticle(state, { sku: input.sku, name: input.name, category: "Test", kind: input.kind ?? "returnable" }, ctx(admin, clock)),
  );
  const opened = unwrap(
    registerOpening(
      created.state,
      { articleId: created.value.articleId, available: input.available, washing: input.washing ?? 0 },
      ctx(admin, clock),
    ),
  );
  return { state: opened.state, articleId: created.value.articleId };
}

export function addDraft(
  state: InventoryState,
  clock: TestClock,
  input: { name: string; from: string; to: string; lines: { articleId: string; quantity: number }[] },
  actor: Actor = coordinator,
): { state: InventoryState; eventId: string } {
  const result = unwrap(
    createDraft(
      state,
      {
        name: input.name,
        customer: "Fictional customer",
        venue: "Fictional venue",
        departureAt: lima(input.from),
        readyAt: lima(input.to),
        lines: input.lines,
      },
      ctx(actor, clock),
    ),
  );
  return { state: result.state, eventId: result.value.eventId };
}

export function addConfirmed(
  state: InventoryState,
  clock: TestClock,
  input: { name: string; from: string; to: string; lines: { articleId: string; quantity: number }[] },
): { state: InventoryState; eventId: string } {
  const draft = addDraft(state, clock, input);
  const confirmed = unwrap(confirmEvent(draft.state, { eventId: draft.eventId }, ctx(coordinator, clock)));
  return { state: confirmed.state, eventId: draft.eventId };
}

export function lineOf(state: InventoryState, eventId: string, articleId: string) {
  const event = state.events.find((e) => e.id === eventId);
  const line = event?.lines.find((l) => l.articleId === articleId);
  if (!line) throw new Error("line not found");
  return line;
}
