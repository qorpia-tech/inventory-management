"use client";

import Link from "@/ui/components/app-link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRightIcon, DropIcon, TruckIcon } from "@phosphor-icons/react";
import type { DomainError, EventLineView, EventView, WashingBatchView } from "@/application/gateway";
import { errorMessage } from "../copy";
import { formatDateTime, formatQty } from "../format";
import { newIntentKey, useGateway, useLive } from "../runtime";
import { ActionBar } from "../components/action-bar";
import { AlertList, EventStatusBadge, EventTimes, RoleNotice } from "../components/domain-bits";
import { Field, Segmented, Stepper, TextInput } from "../components/fields";
import { Badge, Button, ButtonLink, Card, EmptyState, LoadingCards, Notice, PageHeader, SectionTitle, Stat } from "../components/primitives";
import { Sheet } from "../components/sheet";

type Feedback = { tone: "success" | "error"; title: string; body?: string } | null;

function describeError(error: DomainError, lines: EventLineView[]): Feedback {
  const name = (articleId: string) => lines.find((l) => l.articleId === articleId)?.articleName ?? articleId;
  const details =
    error.overReceipts?.map((o) => `${name(o.articleId)}: intentaste ${formatQty(o.attempted)} y quedan ${formatQty(o.pending)} pendientes.`).join(" ") ??
    error.shortages?.map((s) => `${name(s.articleId)}: faltan ${formatQty(s.missing)}.`).join(" ");
  return { tone: "error", title: errorMessage(error), body: details };
}

/** Keeps the same key while one intent is in flight, so a double tap registers once. */
function useIntentKey() {
  const key = useRef("");
  return {
    take: () => (key.current ||= newIntentKey()),
    done: () => {
      key.current = "";
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatch

function DispatchForm({ view, canOperate, onDone }: { view: EventView; canOperate: boolean; onDone: (f: Feedback) => void }) {
  const gateway = useGateway();
  const intent = useIntentKey();
  const lines = view.lines.filter((l) => l.toDispatch > 0);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.lineId, l.toDispatch])));
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((sum, l) => sum + (quantities[l.lineId] ?? 0), 0);

  if (lines.length === 0) {
    return (
      <EmptyState icon={<TruckIcon size={32} aria-hidden />} title="Nada por despachar">
        Todo lo confirmado ya salió o fue liberado. Pasa a la devolución cuando vuelva el material.
      </EmptyState>
    );
  }

  async function submit() {
    if (!gateway || busy || total === 0) return;
    setBusy(true);
    const result = await gateway.dispatch({
      eventId: view.id,
      lines: lines.filter((l) => (quantities[l.lineId] ?? 0) > 0).map((l) => ({ lineId: l.lineId, quantity: quantities[l.lineId]! })),
      idempotencyKey: intent.take(),
    });
    setBusy(false);
    intent.done();
    if (!result.ok) {
      onDone(describeError(result.error, view.lines));
      return;
    }
    const summary = lines
      .filter((l) => (quantities[l.lineId] ?? 0) > 0)
      .map((l) => `${formatQty(quantities[l.lineId]!)} ${l.articleName.toLowerCase()}`)
      .join(", ");
    onDone({ tone: "success", title: "Despacho registrado.", body: `Salieron ${summary}.` });
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const consumable = line.articleKind === "consumable";
          return (
            <Card as="li" key={line.lineId} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="title-3 text-ink-900">{line.articleName}</p>
                {consumable && <Badge tone="neutral">Consumible</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Confirmado" value={formatQty(line.committed)} />
                <Stat label="Despachado" value={formatQty(line.dispatched)} />
                <Stat label="Por despachar" value={formatQty(line.toDispatch)} tone="gold" />
              </div>
              <p className="caption-4 text-ink-600">
                En el estante: <span className="tabular-nums">{formatQty(line.stockAvailable)}</span>
                {consumable && " · Se descuenta como consumo definitivo, sin devolución."}
              </p>
              <Stepper
                label="Cantidad que sale"
                value={quantities[line.lineId] ?? 0}
                max={line.toDispatch}
                disabled={!canOperate}
                onChange={(value) => setQuantities((q) => ({ ...q, [line.lineId]: value }))}
                id={`dispatch-${line.lineId}`}
              />
            </Card>
          );
        })}
      </ul>
      {canOperate && (
        <ActionBar note="Una salida parcial mantiene reservado el saldo.">
          <Button onClick={submit} disabled={busy || total === 0}>
            {busy ? "Registrando…" : `Registrar despacho (${formatQty(total)})`}
          </Button>
        </ActionBar>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Return

interface ReturnDraft {
  good: number;
  washing: number;
  broken: number;
  lost: number;
  brokenReason: string;
  lostReason: string;
}

const EMPTY_RETURN: ReturnDraft = { good: 0, washing: 0, broken: 0, lost: 0, brokenReason: "", lostReason: "" };

function ReturnForm({ view, canOperate, onDone }: { view: EventView; canOperate: boolean; onDone: (f: Feedback) => void }) {
  const gateway = useGateway();
  const intent = useIntentKey();
  const lines = view.lines.filter((l) => l.articleKind === "returnable" && l.dispatched > 0);
  const consumables = view.lines.filter((l) => l.articleKind === "consumable" && l.dispatched > 0);
  const [drafts, setDrafts] = useState<Record<string, ReturnDraft>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const get = (lineId: string) => drafts[lineId] ?? EMPTY_RETURN;
  const update = (lineId: string, patch: Partial<ReturnDraft>) => setDrafts((d) => ({ ...d, [lineId]: { ...(d[lineId] ?? EMPTY_RETURN), ...patch } }));
  const sum = (d: ReturnDraft) => d.good + d.washing + d.broken + d.lost;
  const total = lines.reduce((acc, l) => acc + sum(get(l.lineId)), 0);
  const overLines = lines.filter((l) => sum(get(l.lineId)) > l.pendingReturn);
  const missingReason = lines.some((l) => {
    const d = get(l.lineId);
    return (d.broken > 0 && !d.brokenReason.trim()) || (d.lost > 0 && !d.lostReason.trim());
  });

  if (lines.length === 0) {
    return (
      <EmptyState icon={<TruckIcon size={32} aria-hidden />} title="Todavía no salió material retornable">
        Registra primero el despacho. Los descartables no se devuelven.
      </EmptyState>
    );
  }

  async function submit() {
    setTouched(true);
    if (!gateway || busy || total === 0 || missingReason || overLines.length > 0) return;
    setBusy(true);
    const result = await gateway.registerReturn({
      eventId: view.id,
      lines: lines
        .filter((l) => sum(get(l.lineId)) > 0)
        .map((l) => {
          const d = get(l.lineId);
          return { lineId: l.lineId, good: d.good, washing: d.washing, broken: d.broken, lost: d.lost, brokenReason: d.brokenReason, lostReason: d.lostReason };
        }),
      idempotencyKey: intent.take(),
    });
    setBusy(false);
    intent.done();
    if (!result.ok) {
      onDone(describeError(result.error, view.lines));
      return;
    }
    onDone({ tone: "success", title: "Devolución registrada.", body: `Se recibieron ${formatQty(total)} unidades.` });
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const d = get(line.lineId);
          const entered = sum(d);
          const over = entered > line.pendingReturn;
          const fieldId = (suffix: string) => `ret-${line.lineId}-${suffix}`;
          return (
            <Card as="li" key={line.lineId} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="title-3 text-ink-900">{line.articleName}</p>
                {line.pendingReturn === 0 && <Badge tone="sage">Completo</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Despachado" value={formatQty(line.dispatched)} />
                <Stat label="Recibido" value={formatQty(line.dispatched - line.pendingReturn)} />
                <Stat label="Pendiente" value={formatQty(line.pendingReturn)} tone={line.pendingReturn > 0 ? "apricot" : "sage"} />
              </div>
              {line.pendingReturn > 0 && canOperate && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stepper label="Sanas" value={d.good} max={line.pendingReturn} onChange={(v) => update(line.lineId, { good: v })} id={fieldId("good")} />
                    <Stepper label="Para lavado" value={d.washing} max={line.pendingReturn} onChange={(v) => update(line.lineId, { washing: v })} id={fieldId("washing")} />
                    <Stepper label="Rotas" value={d.broken} max={line.pendingReturn} onChange={(v) => update(line.lineId, { broken: v })} id={fieldId("broken")} tone={d.broken > 0 && touched && !d.brokenReason.trim() ? "error" : "default"} />
                    <Stepper label="Perdidas" value={d.lost} max={line.pendingReturn} onChange={(v) => update(line.lineId, { lost: v })} id={fieldId("lost")} tone={d.lost > 0 && touched && !d.lostReason.trim() ? "error" : "default"} />
                  </div>
                  {d.broken > 0 && (
                    <Field label="Motivo de la rotura" htmlFor={fieldId("broken-reason")} error={touched && !d.brokenReason.trim() ? "El motivo es obligatorio." : undefined}>
                      <TextInput
                        id={fieldId("broken-reason")}
                        value={d.brokenReason}
                        onChange={(e) => update(line.lineId, { brokenReason: e.target.value })}
                        invalid={touched && !d.brokenReason.trim()}
                        placeholder="Por ejemplo, se rompieron al recoger"
                      />
                    </Field>
                  )}
                  {d.lost > 0 && (
                    <Field label="Motivo de la pérdida" htmlFor={fieldId("lost-reason")} error={touched && !d.lostReason.trim() ? "El motivo es obligatorio." : undefined}>
                      <TextInput
                        id={fieldId("lost-reason")}
                        value={d.lostReason}
                        onChange={(e) => update(line.lineId, { lostReason: e.target.value })}
                        invalid={touched && !d.lostReason.trim()}
                        placeholder="Por ejemplo, no se encontraron en el local"
                      />
                    </Field>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={over ? "body-4 text-blush-800" : "caption-4 text-ink-600"} role={over ? "alert" : undefined}>
                      {over
                        ? `Supera lo pendiente: ${formatQty(entered)} de ${formatQty(line.pendingReturn)}.`
                        : `Por registrar: ${formatQty(entered)} de ${formatQty(line.pendingReturn)} pendientes.`}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => update(line.lineId, { good: line.pendingReturn, washing: 0, broken: 0, lost: 0 })}>
                      Todo sano
                    </Button>
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </ul>
      {consumables.length > 0 && (
        <p className="mt-3 caption-4 text-ink-600">
          {consumables.map((l) => l.articleName).join(", ")}: consumo definitivo, no se devuelve.
        </p>
      )}
      {canOperate && lines.some((l) => l.pendingReturn > 0) && (
        <ActionBar note={touched && missingReason ? "Falta el motivo de una rotura o pérdida." : "Puedes recibir por partes. El evento sigue abierto mientras quede algo pendiente."}>
          <Button onClick={submit} disabled={busy || total === 0 || overLines.length > 0}>
            {busy ? "Registrando…" : `Registrar devolución (${formatQty(total)})`}
          </Button>
        </ActionBar>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Screens

export function WarehouseEventScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("id") ?? "";
  const event = useLive(`event:${id}`, (g) => g.getEvent(id));
  const session = useLive("session", (g) => g.getSession());
  const [feedback, setFeedback] = useState<Feedback>(null);
  const view = event.data;

  if (event.loading || !session.data) return <LoadingCards count={2} label="Cargando el evento" />;
  if (!view) {
    return (
      <EmptyState title="No encontramos este evento" action={<ButtonLink href="/almacen/" variant="secondary">Volver al almacén</ButtonLink>}>
        Puede que la demo se haya reiniciado.
      </EmptyState>
    );
  }

  const requested = params.get("modo");
  const mode: "despacho" | "devolucion" = requested === "despacho" || requested === "devolucion" ? requested : view.totals.toDispatch > 0 ? "despacho" : "devolucion";
  const canOperate = session.data.permissions.includes("warehouse.operate");
  const operable = view.status === "confirmed" || view.status === "in_progress";
  const formKey = `${view.id}:${view.lines.map((l) => `${l.toDispatch}/${l.pendingReturn}`).join(",")}`;

  return (
    <>
      <PageHeader
        title={view.name}
        back={{ href: "/almacen/", label: "Almacén" }}
        aside={<EventStatusBadge status={view.status} />}
      />
      <EventTimes departureAt={view.departureAt} readyAt={view.readyAt} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Fuera del almacén" value={formatQty(view.totals.out)} tone={view.totals.out > 0 ? "mist" : undefined} emphasis />
        <Stat label="Pendiente de devolución" value={formatQty(view.totals.pendingReturn)} tone={view.totals.pendingReturn > 0 ? "apricot" : "sage"} emphasis />
      </div>

      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {feedback && (
          <Notice tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
            {feedback.body}
          </Notice>
        )}
        <AlertList alerts={view.alerts} linkEvents={false} />
        {!canOperate && <RoleNotice current={session.data.actor.roles[0]!} needed={["warehouse"]} action="despachar o recibir" />}
        {!operable && (
          <Notice title={view.status === "closed" ? "Evento cerrado" : view.status === "draft" ? "Evento en borrador" : "Evento cancelado"}>
            {view.status === "draft" ? "El coordinador debe confirmarlo antes del despacho." : "No admite despachos ni devoluciones."}
          </Notice>
        )}
      </div>

      {operable && (
        <>
          <div className="mt-4">
            <Segmented
              label="Operación"
              hideLabel
              value={mode}
              onChange={(value) => {
                setFeedback(null);
                router.replace(`${pathname}?id=${view.id}&modo=${value}`, { scroll: false });
              }}
              options={[
                { value: "despacho", label: "Despacho" },
                { value: "devolucion", label: "Devolución" },
              ]}
            />
          </div>
          <div className="mt-4">
            {mode === "despacho" ? (
              <DispatchForm key={formKey} view={view} canOperate={canOperate} onDone={setFeedback} />
            ) : (
              <ReturnForm key={formKey} view={view} canOperate={canOperate} onDone={setFeedback} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function WashingBatchCard({ batch, canOperate, onFeedback }: { batch: WashingBatchView; canOperate: boolean; onFeedback: (f: Feedback) => void }) {
  const gateway = useGateway();
  const intent = useIntentKey();
  const [quantity, setQuantity] = useState(batch.remaining);
  const [lossOpen, setLossOpen] = useState(false);
  const [loss, setLoss] = useState<{ outcome: "broken" | "lost"; quantity: number; reason: string; touched: boolean }>({ outcome: "broken", quantity: 1, reason: "", touched: false });
  const [busy, setBusy] = useState(false);

  async function release() {
    if (!gateway || busy) return;
    setBusy(true);
    const result = await gateway.releaseWashing({ batchId: batch.id, quantity, idempotencyKey: intent.take() });
    setBusy(false);
    intent.done();
    onFeedback(
      result.ok
        ? { tone: "success", title: "Lavado liberado.", body: `${formatQty(quantity)} ${batch.articleName.toLowerCase()} vuelven a estar disponibles.` }
        : { tone: "error", title: errorMessage(result.error) },
    );
  }

  async function registerLoss() {
    setLoss((l) => ({ ...l, touched: true }));
    if (!gateway || busy || !loss.reason.trim()) return;
    setBusy(true);
    const result = await gateway.registerWashingLoss({ batchId: batch.id, quantity: loss.quantity, outcome: loss.outcome, reason: loss.reason, idempotencyKey: intent.take() });
    setBusy(false);
    intent.done();
    setLossOpen(false);
    onFeedback(result.ok ? { tone: "success", title: "Baja registrada en el lote de lavado." } : { tone: "error", title: errorMessage(result.error) });
  }

  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="title-3 text-ink-900">{batch.articleName}</p>
          <p className="caption-4 text-ink-600">
            {batch.eventName ? `Devolución de ${batch.eventName}` : "Saldo inicial, sin evento"} · {formatDateTime(batch.createdAt)}
          </p>
        </div>
        <Badge tone="apricot" icon={<DropIcon size={14} weight="fill" aria-hidden />}>
          {formatQty(batch.remaining)} en lavado
        </Badge>
      </div>
      {canOperate && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <Stepper label="Cantidad lista" value={quantity} min={1} max={batch.remaining} onChange={setQuantity} id={`release-${batch.id}`} />
            <Button variant="dark" onClick={release} disabled={busy}>
              Liberar
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="w-fit" onClick={() => setLossOpen(true)}>
            Registrar rotura o pérdida en lavado
          </Button>
        </>
      )}
      <Sheet
        open={lossOpen}
        onClose={() => setLossOpen(false)}
        title="Rotura o pérdida en lavado"
        description={`${batch.articleName}. El lote sabe de qué evento viene.`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setLossOpen(false)}>
              Volver
            </Button>
            <Button variant="danger" onClick={registerLoss} disabled={busy}>
              Registrar baja
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Segmented
            label="Resultado"
            value={loss.outcome}
            onChange={(outcome) => setLoss((l) => ({ ...l, outcome }))}
            options={[
              { value: "broken", label: "Rota" },
              { value: "lost", label: "Perdida" },
            ]}
          />
          <Stepper label="Cantidad" value={loss.quantity} min={1} max={batch.remaining} onChange={(q) => setLoss((l) => ({ ...l, quantity: q }))} id={`loss-${batch.id}`} />
          <Field label="Motivo" htmlFor={`loss-reason-${batch.id}`} error={loss.touched && !loss.reason.trim() ? "El motivo es obligatorio." : undefined}>
            <TextInput id={`loss-reason-${batch.id}`} value={loss.reason} onChange={(e) => setLoss((l) => ({ ...l, reason: e.target.value }))} invalid={loss.touched && !loss.reason.trim()} />
          </Field>
        </div>
      </Sheet>
    </Card>
  );
}

export function WarehouseScreen() {
  const agenda = useLive("agenda", (g) => g.listAgenda());
  const batches = useLive("batches", (g) => g.listWashingBatches());
  const alerts = useLive("alerts", (g) => g.listAlerts());
  const session = useLive("session", (g) => g.getSession());
  const [feedback, setFeedback] = useState<Feedback>(null);
  const canOperate = session.data?.permissions.includes("warehouse.operate") ?? false;
  const operations = agenda.data?.filter((e) => e.status === "confirmed" || e.status === "in_progress");

  return (
    <>
      <PageHeader title="Almacén" description="Despachos, devoluciones y lavado. Pensado para usarlo desde el celular." />
      <div className="flex flex-col gap-3" aria-live="polite">
        {feedback && (
          <Notice tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
            {feedback.body}
          </Notice>
        )}
        {session.data && !canOperate && <RoleNotice current={session.data.actor.roles[0]!} needed={["warehouse"]} action="despachar, recibir o liberar lavado" />}
        {alerts.data && <AlertList alerts={alerts.data} />}
      </div>

      <SectionTitle>Eventos por atender</SectionTitle>
      {!operations ? (
        <LoadingCards count={2} label="Cargando eventos" />
      ) : operations.length === 0 ? (
        <EmptyState title="No hay eventos confirmados">Cuando el coordinador confirme un evento, aparecerá aquí para despacharlo.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {operations.map((event) => (
            <li key={event.id}>
              <Link href={`/almacen/evento/?id=${event.id}`} className="pressable flex flex-col gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="title-3 text-ink-900">{event.name}</span>
                    <span className="caption-4 tabular-nums text-ink-600">Salida {formatDateTime(event.departureAt)}</span>
                  </span>
                  <ArrowRightIcon size={20} className="mt-1 shrink-0 text-ink-600" aria-hidden />
                </span>
                <span className="grid grid-cols-2 gap-2">
                  <Stat label="Por despachar" value={formatQty(event.toDispatch)} tone={event.toDispatch > 0 ? "gold" : undefined} />
                  <Stat label="Por devolver" value={formatQty(event.pendingReturn)} tone={event.pendingReturn > 0 ? "apricot" : undefined} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>En lavado</SectionTitle>
      <p className="-mt-1 pb-2 caption-4 text-ink-600">Lo recibido para lavado sigue bloqueado hasta registrar su liberación.</p>
      {!batches.data ? (
        <LoadingCards count={1} label="Cargando lotes de lavado" />
      ) : batches.data.length === 0 ? (
        <EmptyState icon={<DropIcon size={32} aria-hidden />} title="No hay nada en lavado" />
      ) : (
        <ul className="flex flex-col gap-3">
          {batches.data.map((batch) => (
            <WashingBatchCard key={`${batch.id}-${batch.remaining}`} batch={batch} canOperate={canOperate} onFeedback={setFeedback} />
          ))}
        </ul>
      )}
    </>
  );
}
