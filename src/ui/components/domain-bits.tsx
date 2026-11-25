"use client";

import Link from "./app-link";
import { ClockCountdownIcon, UserSwitchIcon, WarningIcon } from "@phosphor-icons/react";
import type { Alert, ArticleKind, EventStatus, LedgerEntry, Role } from "@/application/gateway";
import { BUCKET_LABEL, MOVEMENT_LABEL, ROLE_LABEL, STATUS_LABEL } from "../copy";
import { formatDateTime, formatQty, formatTime, formatShortDate } from "../format";
import { useDemoPanel } from "../demo/demo-panel";
import { Badge, Button, type Tone } from "./primitives";

const STATUS_TONE: Record<EventStatus, Tone> = {
  draft: "sand",
  confirmed: "gold",
  in_progress: "mist",
  closed: "neutral",
  cancelled: "neutral",
};

/** Departure and ready time, with the hour large enough to read at a glance. */
export function EventTimes({ departureAt, readyAt }: { departureAt: number; readyAt: number }) {
  const cell = (label: string, epoch: number) => (
    <div className="flex flex-col rounded-xl bg-ivory-100 px-3 py-2">
      <dt className="caption-4 text-ink-600">{label}</dt>
      <dd className="flex flex-col">
        <span className="body-6 text-ink-700">{formatShortDate(epoch)}</span>
        <span className="number-md text-ink-900">{formatTime(epoch)}</span>
      </dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-2 gap-2">
      {cell("Salida prevista", departureAt)}
      {cell("Material listo", readyAt)}
    </dl>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function KindBadge({ kind }: { kind: ArticleKind }) {
  return <Badge tone={kind === "consumable" ? "neutral" : "sage"}>{kind === "consumable" ? "Consumible" : "Retornable"}</Badge>;
}

function alertText(alert: Alert): { title: string; body: string } {
  if (alert.kind === "overdue") {
    return {
      title: `Atraso · ${alert.articleName}: ${formatQty(alert.quantity)} sin devolver`,
      body: `${alert.eventName}. El retorno vencía ${formatShortDate(alert.dueAt)} a las ${formatTime(alert.dueAt)}. Siguen bloqueadas hasta recibirlas.`,
    };
  }
  if (alert.kind === "expired") {
    return {
      title: `Reserva vencida · ${alert.articleName}: ${formatQty(alert.quantity)} sin despachar`,
      body: `${alert.eventName}. Ya no compromete stock; para cerrar, libera ese saldo.`,
    };
  }
  return {
    title: `Conflicto · ${alert.articleName}: faltan ${formatQty(alert.shortage)}`,
    body: `Afecta a ${alert.affectedEventNames.join(", ")} desde ${formatDateTime(alert.at)}. Resuélvelo antes del despacho: recibe lo atrasado, libera lavado o reduce la reserva.`,
  };
}

export function AlertList({ alerts, linkEvents = true }: { alerts: Alert[]; linkEvents?: boolean }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Alertas">
      {alerts.map((alert, index) => {
        const text = alertText(alert);
        const eventId = alert.kind === "conflict" ? alert.affectedEventIds[0] : alert.eventId;
        const tone = alert.kind === "conflict" ? "bg-blush-100 text-blush-800" : "bg-apricot-100 text-apricot-800";
        return (
          <li key={`${alert.kind}-${index}`} className={`flex items-start gap-3 rounded-xl p-3 ${tone}`}>
            {alert.kind === "conflict" ? (
              <WarningIcon size={20} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
            ) : (
              <ClockCountdownIcon size={20} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="body-4">{text.title}</p>
              <p className="body-6">{text.body}</p>
              {linkEvents && eventId && (
                <Link href={`/agenda/evento/?id=${eventId}`} className="inline-flex min-h-11 w-fit items-center body-4 underline underline-offset-2">
                  Abrir el evento
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LedgerList({ entries, showArticle = true, showEvent = true }: { entries: LedgerEntry[]; showArticle?: boolean; showEvent?: boolean }) {
  if (entries.length === 0) {
    return <p className="body-6 text-ink-600">Todavía no hay movimientos.</p>;
  }
  return (
    <ol className="flex flex-col divide-y divide-ivory-300 rounded-2xl border border-ivory-300 bg-white">
      {entries.map((entry) => (
        <li key={`${entry.movementId}-${entry.lineNo}`} className="flex flex-col gap-1 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="title-4 text-ink-900">
              {MOVEMENT_LABEL[entry.kind]}
              {showArticle && <span className="font-normal text-ink-700"> · {entry.articleName}</span>}
            </p>
            <p className="caption-4 tabular-nums text-ink-600">{formatDateTime(entry.occurredAt)}</p>
          </div>
          <p className="body-6 text-ink-700">
            <span className="font-semibold tabular-nums text-ink-900">{formatQty(entry.quantity)}</span> de {BUCKET_LABEL[entry.from]} a {BUCKET_LABEL[entry.to]}
            {showEvent && entry.eventName && <> · {entry.eventName}</>}
          </p>
          <p className="caption-4 text-ink-600">
            {entry.recordedBy.name} · {entry.locationName}
            {entry.reason && <> · Motivo: {entry.reason}</>}
            {entry.acceptShortage && <> · Faltante aceptado</>}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Explains what the current role can do and offers the role switch. */
export function RoleNotice({ current, needed, action }: { current: Role; needed: Role[]; action: string }) {
  const panel = useDemoPanel();
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-ivory-200 p-3 text-ink-700" role="note">
      <p className="body-6">
        Viendo como <strong>{ROLE_LABEL[current]}</strong>. Para {action}, cambia a {needed.map((r) => ROLE_LABEL[r]).join(" o ")}.
      </p>
      <Button size="sm" variant="secondary" onClick={panel.open} className="w-fit">
        <UserSwitchIcon size={18} aria-hidden />
        Cambiar de rol
      </Button>
    </div>
  );
}
