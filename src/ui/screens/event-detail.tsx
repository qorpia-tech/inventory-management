"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MapPinIcon, PlusIcon, TrashIcon, TruckIcon, UserIcon } from "@phosphor-icons/react";
import type { DomainError, EventLineView, EventView, ShortageLine } from "@/application/gateway";
import { errorMessage } from "../copy";
import { formatDateTime, formatQty } from "../format";
import { newIntentKey, useDemo, useDemoControls, useGateway, useLive } from "../runtime";
import { ActionBar } from "../components/action-bar";
import { AlertList, EventStatusBadge, EventTimes, KindBadge, LedgerList, RoleNotice } from "../components/domain-bits";
import { Field, SelectInput, Stepper, TextArea } from "../components/fields";
import { Button, ButtonLink, Card, EmptyState, LoadingCards, Notice, PageHeader, SectionTitle, Stat } from "../components/primitives";
import { Sheet } from "../components/sheet";

type Feedback = { tone: "success" | "error"; title: string; body?: string; shortages?: ShortageLine[] } | null;

function ShortageTable({ shortages, lines }: { shortages: ShortageLine[]; lines: EventLineView[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {shortages.map((s) => {
        const name = lines.find((l) => l.articleId === s.articleId)?.articleName ?? s.articleId;
        return (
          <li key={s.articleId} className="rounded-lg bg-white/70 p-2">
            <p className="body-4">{name}</p>
            <p className="body-6 tabular-nums">
              Solicitado {formatQty(s.requested)} · Disponible {formatQty(s.available)} · Faltan {formatQty(s.missing)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function DraftLine({
  line,
  canEdit,
  onQuantity,
  onRemove,
}: {
  line: EventLineView;
  canEdit: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const available = Math.max(0, line.available);
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="title-3 text-ink-900">{line.articleName}</p>
          <div className="flex flex-wrap items-center gap-2 caption-4 text-ink-600">
            <span>{line.articleSku}</span>
            <KindBadge kind={line.articleKind} />
          </div>
        </div>
        {canEdit && (
          <button type="button" onClick={onRemove} className="pressable -mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-600" aria-label={`Quitar ${line.articleName}`}>
            <TrashIcon size={20} aria-hidden />
          </button>
        )}
      </div>
      {canEdit ? (
        <Stepper label="Cantidad solicitada" value={line.requested} min={1} onChange={onQuantity} id={`qty-${line.lineId}`} />
      ) : (
        <Stat label="Solicitado" value={formatQty(line.requested)} />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Disponible" value={formatQty(available)} tone="sage" />
        <Stat label={line.missing > 0 ? "Faltan" : "Faltante"} value={formatQty(line.missing)} tone={line.missing > 0 ? "blush" : "neutral"} />
      </div>
      {line.otherDraftsDemand > 0 && (
        <p className="caption-4 text-ink-600">Otros borradores piden {formatQty(line.otherDraftsDemand)} en esta franja. No comprometen stock.</p>
      )}
    </Card>
  );
}

function CommittedLine({
  line,
  canEdit,
  onSave,
}: {
  line: EventLineView;
  canEdit: boolean;
  onSave: (quantity: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(line.committed);
  const consumable = line.articleKind === "consumable";
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="title-3 text-ink-900">{line.articleName}</p>
        <div className="flex flex-wrap items-center gap-2 caption-4 text-ink-600">
          <span>{line.articleSku}</span>
          <KindBadge kind={line.articleKind} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Confirmado" value={formatQty(line.committed)} />
        <Stat label="Despachado" value={formatQty(line.dispatched)} tone={line.dispatched > 0 ? "mist" : undefined} />
        {consumable ? (
          <Stat label="Consumido" value={formatQty(line.dispatched)} />
        ) : (
          <Stat label="Por devolver" value={formatQty(line.pendingReturn)} tone={line.pendingReturn > 0 ? "apricot" : "sage"} />
        )}
      </div>
      <p className="body-6 text-ink-700">
        Libres para otro evento en esta franja: <strong className="tabular-nums text-ink-900">{formatQty(line.freeForOthers)}</strong>
      </p>
      {!consumable && line.dispatched > 0 && (
        <p className="caption-4 text-ink-600">
          Recibido: {formatQty(line.returnedGood)} sanas · {formatQty(line.returnedWashing)} para lavado · {formatQty(line.broken)} rotas · {formatQty(line.lost)} perdidas
        </p>
      )}
      {consumable && line.dispatched > 0 && <p className="caption-4 text-ink-600">Consumo definitivo: no requiere devolución.</p>}
      {line.released > 0 && <p className="caption-4 text-ink-600">Saldo liberado: {formatQty(line.released)}</p>}
      {canEdit &&
        (editing ? (
          <div className="flex flex-col gap-2 rounded-xl bg-ivory-100 p-3">
            <Stepper label="Nueva cantidad confirmada" value={quantity} min={Math.max(1, line.dispatched + line.released)} onChange={setQuantity} id={`edit-${line.lineId}`} />
            <p className="caption-4 text-ink-600">Si aumentas, se vuelve a comprobar la disponibilidad.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                Volver
              </Button>
              <Button
                size="sm"
                variant="dark"
                disabled={quantity === line.committed}
                onClick={async () => {
                  if (await onSave(quantity)) setEditing(false);
                }}
              >
                Guardar cantidad
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="w-fit"
            onClick={() => {
              setQuantity(line.committed);
              setEditing(true);
            }}
          >
            Cambiar cantidad
          </Button>
        ))}
    </Card>
  );
}

function AddArticle({ event, onAdd }: { event: EventView; onAdd: (articleId: string, quantity: number) => Promise<boolean> }) {
  const articles = useLive("articles", (g) => g.listArticles());
  const [articleId, setArticleId] = useState("");
  const [quantity, setQuantity] = useState(10);
  const options = (articles.data ?? []).filter((a) => !event.lines.some((l) => l.articleId === a.id));
  if (options.length === 0) return null;
  return (
    <Card className="flex flex-col gap-3">
      <p className="title-3">Agregar artículo</p>
      <Field label="Artículo" htmlFor="add-article">
        <SelectInput id="add-article" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          <option value="">Elige un artículo</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Stepper label="Cantidad" value={quantity} min={1} onChange={setQuantity} id="add-qty" />
      <Button
        variant="secondary"
        disabled={!articleId}
        onClick={async () => {
          if (await onAdd(articleId, quantity)) setArticleId("");
        }}
      >
        <PlusIcon size={18} weight="bold" aria-hidden />
        Agregar
      </Button>
    </Card>
  );
}

export function EventDetailScreen() {
  const id = useSearchParams().get("id") ?? "";
  const gateway = useGateway();
  const demo = useDemo();
  const controls = useDemoControls();
  const event = useLive(`event:${id}`, (g) => g.getEvent(id));
  const session = useLive("session", (g) => g.getSession());
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sheet, setSheet] = useState<null | "cancel" | "close" | "release">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef<number | undefined>(undefined);
  const confirmKey = useRef<string>("");

  const view = event.data;
  useEffect(() => {
    if (view) version.current = view.version;
  }, [view]);
  useEffect(() => {
    if (demo && controls && id === demo.refs.weddingId) controls.markVisited("weddingOpened");
  }, [demo, controls, id]);

  if (event.loading || !session.data) return <LoadingCards count={2} label="Cargando el evento" />;
  if (!view) {
    return (
      <EmptyState title="No encontramos este evento" action={<ButtonLink href="/agenda/" variant="secondary">Volver a la agenda</ButtonLink>}>
        Puede que la demo se haya reiniciado.
      </EmptyState>
    );
  }

  const permissions = session.data.permissions;
  const canEdit = permissions.includes("event.edit") && (view.status === "draft" || view.status === "confirmed" || view.status === "in_progress");
  const canLifecycle = permissions.includes("event.lifecycle");
  const role = session.data.actor.roles[0]!;
  const isDraft = view.status === "draft";

  function report(error: DomainError, title?: string) {
    setFeedback({ tone: "error", title: title ?? errorMessage(error), shortages: error.shortages });
  }

  async function changeQuantity(articleId: string, quantity: number): Promise<boolean> {
    if (!gateway) return false;
    const result = await gateway.setLineQuantity({ eventId: view!.id, articleId, quantity, expectedVersion: version.current });
    if (!result.ok) {
      report(result.error, result.error.code === "shortage" ? "No alcanza el stock para esa cantidad. No se cambió nada." : undefined);
      return false;
    }
    version.current = result.value.version;
    if (!isDraft) setFeedback({ tone: "success", title: "Cantidad actualizada." });
    return true;
  }

  async function removeArticle(articleId: string) {
    if (!gateway) return;
    const result = await gateway.removeLine({ eventId: view!.id, articleId, expectedVersion: version.current });
    if (!result.ok) report(result.error);
    else version.current = result.value.version;
  }

  async function confirm() {
    if (!gateway || busy) return;
    setBusy(true);
    confirmKey.current ||= newIntentKey();
    const result = await gateway.confirmEvent({ eventId: view!.id, expectedVersion: version.current, idempotencyKey: confirmKey.current });
    setBusy(false);
    if (!result.ok) {
      confirmKey.current = "";
      report(result.error);
      return;
    }
    confirmKey.current = "";
    setFeedback({ tone: "success", title: "Reserva confirmada.", body: "Las cantidades quedaron comprometidas para este horario." });
  }

  async function lifecycle(kind: "cancel" | "close" | "release") {
    if (!gateway) return;
    setBusy(true);
    const input = { eventId: view!.id, expectedVersion: version.current };
    const result =
      kind === "cancel"
        ? await gateway.cancelEvent(input)
        : kind === "close"
          ? await gateway.closeEvent({ ...input, note })
          : await gateway.releaseRemaining(input);
    setBusy(false);
    setSheet(null);
    if (!result.ok) {
      report(result.error);
      return;
    }
    setFeedback({
      tone: "success",
      title: kind === "cancel" ? "Evento cancelado. Se liberó toda la reserva." : kind === "close" ? "Evento cerrado." : "Saldo no despachado liberado.",
    });
  }

  const totalToRelease = view.lines.reduce((sum, l) => sum + l.toDispatch, 0);
  const shortLines = isDraft ? view.lines.filter((l) => l.missing > 0) : [];

  return (
    <>
      <PageHeader title={view.name} back={{ href: "/agenda/", label: "Agenda" }} aside={<EventStatusBadge status={view.status} />} description={view.customer} />

      {shortLines.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 rounded-xl bg-blush-100 p-3 text-blush-800" role="status">
          <p className="body-4">{shortLines.length === 1 ? "Un artículo no alcanza" : `${shortLines.length} artículos no alcanzan`}</p>
          {shortLines.map((line) => (
            <p key={line.lineId} className="body-6 tabular-nums">
              {line.articleName}: piden {formatQty(line.requested)}, disponibles {formatQty(Math.max(0, line.available))}, faltan {formatQty(line.missing)}
            </p>
          ))}
        </div>
      )}

      <Card className="flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 body-6 text-ink-700">
          <MapPinIcon size={16} aria-hidden />
          {view.venue}
        </p>
        <EventTimes departureAt={view.departureAt} readyAt={view.readyAt} />
        {!isDraft && view.status !== "cancelled" && (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Fuera del almacén" value={formatQty(view.totals.out)} tone={view.totals.out > 0 ? "mist" : undefined} />
            <Stat label="Por despachar" value={formatQty(view.totals.toDispatch)} />
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {feedback && (
          <Notice tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
            {feedback.body}
            {feedback.shortages && feedback.shortages.length > 0 && <ShortageTable shortages={feedback.shortages} lines={view.lines} />}
          </Notice>
        )}
        <AlertList alerts={view.alerts} linkEvents={false} />
      </div>

      <SectionTitle id="lines-title">Artículos</SectionTitle>
      {isDraft && <p className="-mt-1 pb-3 caption-4 text-ink-600">Borrador: simula cantidades sin comprometer stock. Al confirmar se valida todo de nuevo.</p>}
      {view.lines.length === 0 ? (
        <EmptyState title="Este evento no tiene artículos">Agrega copas, platos, fundas, manteles o descartables para ver su disponibilidad.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3" aria-labelledby="lines-title">
          {view.lines.map((line) =>
            isDraft ? (
              <DraftLine
                key={line.lineId}
                line={line}
                canEdit={canEdit}
                onQuantity={(q) => void changeQuantity(line.articleId, q)}
                onRemove={() => void removeArticle(line.articleId)}
              />
            ) : (
              <CommittedLine key={`${line.lineId}-${line.committed}`} line={line} canEdit={canEdit && view.status !== "closed"} onSave={(q) => changeQuantity(line.articleId, q)} />
            ),
          )}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3">
          <AddArticle event={view} onAdd={changeQuantity} />
        </div>
      )}

      {view.status === "in_progress" && view.closeBlockers.length > 0 && (
        <div className="mt-4 rounded-xl bg-ivory-200 p-3">
          <p className="body-4 text-ink-900">Para cerrar falta resolver</p>
          <ul className="mt-1 flex flex-col gap-1 body-6 text-ink-700">
            {view.closeBlockers.map((b) => {
              const name = view.lines.find((l) => l.lineId === b.lineId)?.articleName;
              return (
                <li key={b.lineId}>
                  {name}: {b.pendingReturn > 0 && `${formatQty(b.pendingReturn)} por devolver`}
                  {b.pendingReturn > 0 && b.toDispatch > 0 && " · "}
                  {b.toDispatch > 0 && `${formatQty(b.toDispatch)} sin despachar ni liberar`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {view.washingBatches.length > 0 && (
        <>
          <SectionTitle>En lavado desde este evento</SectionTitle>
          <ul className="flex flex-col gap-2">
            {view.washingBatches.map((batch) => (
              <li key={batch.id} className="flex items-center justify-between gap-3 rounded-xl bg-apricot-100 p-3 text-apricot-800">
                <span className="body-6">
                  {batch.articleName} · devolución del {formatDateTime(batch.createdAt)}
                </span>
                <span className="body-4 tabular-nums">{batch.remaining > 0 ? `${formatQty(batch.remaining)} en lavado` : "Liberado"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Historial del evento</SectionTitle>
      <LedgerList entries={view.movements} showEvent={false} />
      <p className="mt-2 inline-flex items-center gap-1 caption-4 text-ink-600">
        <UserIcon size={14} aria-hidden />
        Cada movimiento guarda usuario, hora, artículo, cantidad y motivo.
      </p>

      {canLifecycle && (view.status === "draft" || view.status === "confirmed" || view.status === "in_progress") && (
        <ActionBar
          note={
            view.status === "in_progress" && !view.canClose
              ? "Cerrar se habilita cuando todo está despachado o liberado y no queda nada por devolver."
              : undefined
          }
        >
          {view.status === "draft" && (
            <>
              <Button variant="secondary" className="flex-none!" onClick={() => setSheet("cancel")}>
                Cancelar
              </Button>
              <Button onClick={confirm} disabled={busy || !view.canConfirm}>
                {busy ? "Confirmando…" : "Confirmar reserva"}
              </Button>
            </>
          )}
          {view.status === "confirmed" && (
            <Button variant="secondary" onClick={() => setSheet("cancel")} disabled={!view.canCancel}>
              Cancelar evento
            </Button>
          )}
          {view.status === "in_progress" && (
            <>
              {view.canRelease && (
                <Button variant="secondary" onClick={() => setSheet("release")}>
                  Liberar saldo
                </Button>
              )}
              <Button onClick={() => setSheet("close")} disabled={!view.canClose}>
                Cerrar evento
              </Button>
            </>
          )}
        </ActionBar>
      )}

      {!canLifecycle && view.status !== "closed" && view.status !== "cancelled" && (
        <div className="mt-6 flex flex-col gap-3">
          {permissions.includes("warehouse.operate") && !isDraft ? (
            <ButtonLink href={`/almacen/evento/?id=${view.id}`} variant="dark">
              <TruckIcon size={18} aria-hidden />
              Ir a despacho y devolución
            </ButtonLink>
          ) : null}
          <RoleNotice current={role} needed={["coordinator"]} action="editar, confirmar o cerrar este evento" />
        </div>
      )}

      <Sheet
        open={sheet === "cancel"}
        onClose={() => setSheet(null)}
        title={isDraft ? "¿Cancelar el borrador?" : "¿Cancelar el evento?"}
        description="Nada salió del almacén, así que se libera toda la reserva. Esta acción no se deshace."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheet(null)}>
              Volver
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => lifecycle("cancel")}>
              Sí, cancelar
            </Button>
          </div>
        }
      >
        <p className="body-6 text-ink-700">{view.name}</p>
      </Sheet>

      <Sheet
        open={sheet === "release"}
        onClose={() => setSheet(null)}
        title="¿Liberar lo no despachado?"
        description={`Se liberan ${formatQty(totalToRelease)} unidades reservadas que no salieron. Vuelven a estar disponibles para otros eventos.`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheet(null)}>
              Volver
            </Button>
            <Button variant="dark" disabled={busy} onClick={() => lifecycle("release")}>
              Liberar
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-1 body-6 text-ink-700">
          {view.lines
            .filter((l) => l.toDispatch > 0)
            .map((l) => (
              <li key={l.lineId}>
                {l.articleName}: {formatQty(l.toDispatch)}
              </li>
            ))}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === "close"}
        onClose={() => setSheet(null)}
        title="Cerrar el evento"
        description="Todo está devuelto o resuelto. Lo que quedó en lavado sigue a cargo del almacén."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheet(null)}>
              Volver
            </Button>
            <Button disabled={busy} onClick={() => lifecycle("close")}>
              Cerrar evento
            </Button>
          </div>
        }
      >
        <Field label="Nota de cierre (opcional)" htmlFor="close-note">
          <TextArea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por ejemplo, todo conforme" />
        </Field>
      </Sheet>
    </>
  );
}
