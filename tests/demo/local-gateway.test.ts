import { describe, expect, it } from "vitest";
import { LocalDemoGateway, MemoryStore, STORAGE_KEY } from "@/demo/local-gateway";
import { HOUR_MS } from "@/lib/lima-time";
import { lima } from "../domain/helpers";

function setup(start = lima("2026-11-25T09:00")) {
  const store = new MemoryStore();
  let real = start;
  const realNow = () => real;
  const gateway = new LocalDemoGateway({ store, realNow });
  return { store, gateway, realNow, setReal: (value: number) => (real = value) };
}

async function cupsLine(gateway: LocalDemoGateway) {
  const { refs } = gateway.getDemo();
  const event = await gateway.getEvent(refs.weddingId);
  return { event: event!, line: event!.lines.find((l) => l.articleId === refs.cupsId)! };
}

describe("Local demo gateway (browser adapter of the gateway port)", () => {
  it("seeds the scenario on first load and starts as coordinator with the tour at step 1", async () => {
    const { gateway } = setup();
    const demo = gateway.getDemo();
    expect(demo.role).toBe("coordinator");
    expect(demo.tour.map((s) => s.done)).toEqual([false, false, false, false, false, false]);
    const agenda = await gateway.listAgenda();
    expect(agenda.map((e) => e.status)).toEqual(["closed", "confirmed", "draft", "confirmed"]);
    expect((await cupsLine(gateway)).line).toMatchObject({ requested: 100, available: 90, missing: 10 });
  });

  it("applies the permission matrix of the selected role", async () => {
    const { gateway } = setup();
    const { refs } = gateway.getDemo();
    gateway.setRole("warehouse");
    expect((await gateway.getSession()).actor.roles).toEqual(["warehouse"]);
    const attempt = await gateway.confirmEvent({ eventId: refs.weddingId });
    expect(attempt).toEqual({ ok: false, error: { code: "forbidden" } });
  });

  it("walks the script and keeps every record after a reload", async () => {
    const { gateway, store, realNow } = setup();
    const { refs } = gateway.getDemo();
    gateway.markVisited("weddingOpened");
    expect((await gateway.setLineQuantity({ eventId: refs.weddingId, articleId: refs.cupsId, quantity: 90 })).ok).toBe(true);
    expect((await gateway.confirmEvent({ eventId: refs.weddingId })).ok).toBe(true);

    gateway.setRole("warehouse");
    const { event } = await cupsLine(gateway);
    const dispatch = { eventId: refs.weddingId, lines: event.lines.map((l) => ({ lineId: l.lineId, quantity: l.toDispatch })), idempotencyKey: "tap-1" };
    expect((await gateway.dispatch(dispatch)).ok).toBe(true);
    const doubleTap = await gateway.dispatch(dispatch);
    expect(doubleTap).toMatchObject({ ok: true, replayed: true });

    const reloaded = new LocalDemoGateway({ store, realNow });
    const after = await cupsLine(reloaded);
    expect(after.event.totals.out).toBe(90);
    expect(after.event.movements.filter((m) => m.kind === "dispatch")).toHaveLength(2); // two lines, one movement
    expect(new Set(after.event.movements.filter((m) => m.kind === "dispatch").map((m) => m.movementId)).size).toBe(1);
    expect(reloaded.getDemo().role).toBe("warehouse");
    expect(reloaded.getDemo().tour.slice(0, 3).map((s) => s.done)).toEqual([true, true, true]);

    const lineId = after.line.lineId;
    expect((await reloaded.registerReturn({ eventId: refs.weddingId, lines: [{ lineId, good: 86, broken: 2, brokenReason: "Se rompieron en el brindis" }] })).ok).toBe(true);
    expect((await reloaded.registerReturn({ eventId: refs.weddingId, lines: [{ lineId, washing: 2 }] })).ok).toBe(true);
    reloaded.markVisited("staffOpened");
    reloaded.markVisited("landingOpened");
    expect(reloaded.getDemo().tour.map((s) => s.done)).toEqual([true, true, true, true, true, true]);
  });

  it("moves the demo clock only forward", () => {
    const { gateway, realNow } = setup();
    const start = gateway.getDemo().now;
    gateway.advanceClock(2 * HOUR_MS);
    expect(gateway.getDemo().now).toBe(start + 2 * HOUR_MS);
    gateway.jumpClockTo(start);
    expect(gateway.getDemo().now).toBe(start + 2 * HOUR_MS);
    expect(realNow()).toBe(start);
  });

  it("only an administrator can reset, and the reset restores the scenario and the clock", async () => {
    const { gateway } = setup();
    const { refs } = gateway.getDemo();
    await gateway.setLineQuantity({ eventId: refs.weddingId, articleId: refs.cupsId, quantity: 90 });
    gateway.advanceClock(HOUR_MS);
    expect(gateway.reset()).toEqual({ ok: false, error: { code: "forbidden" } });
    gateway.setRole("admin");
    expect(gateway.reset()).toEqual({ ok: true, value: undefined });
    const demo = gateway.getDemo();
    expect(demo.clockOffsetMs).toBe(0);
    expect(demo.role).toBe("admin");
    expect((await cupsLine(gateway)).line.requested).toBe(100);
  });

  it("recovers from unreadable storage by seeding again", async () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, "{not json");
    const gateway = new LocalDemoGateway({ store, realNow: () => lima("2026-11-25T09:00") });
    expect((await gateway.listAgenda()).length).toBe(4);
  });

  it("reseeds an untouched scenario once its Saturday is in the past, and flags a used one as stale", async () => {
    const { store, setReal, realNow } = setup();
    setReal(lima("2026-12-02T09:00"));
    const untouched = new LocalDemoGateway({ store, realNow });
    expect(untouched.getDemo().refs.saturday).toBe("2026-12-05");
    expect(untouched.getDemo().stale).toBe(false);

    await untouched.setLineQuantity({ eventId: untouched.getDemo().refs.weddingId, articleId: untouched.getDemo().refs.cupsId, quantity: 90 });
    setReal(lima("2026-12-09T09:00"));
    const used = new LocalDemoGateway({ store, realNow });
    expect(used.getDemo().refs.saturday).toBe("2026-12-05");
    expect(used.getDemo().stale).toBe(true);
  });
});
