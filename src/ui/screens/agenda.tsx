"use client";

import Link from "@/ui/components/app-link";
import { CalendarDotsIcon, MapPinIcon, PlusIcon, WarningIcon } from "@phosphor-icons/react";
import type { AgendaItem } from "@/application/gateway";
import { limaDateKey } from "@/lib/lima-time";
import { formatDateTime, formatLongDate, formatQty, formatTime } from "../format";
import { useLive } from "../runtime";
import { ActionBar } from "../components/action-bar";
import { EventStatusBadge, RoleNotice } from "../components/domain-bits";
import { Badge, ButtonLink, EmptyState, LoadingCards, PageHeader } from "../components/primitives";

function groupByDate(items: AgendaItem[]): { date: string; label: string; items: AgendaItem[] }[] {
  const groups = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = limaDateKey(item.departureAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([date, list]) => ({ date, label: formatLongDate(list[0]!.departureAt), items: list }));
}

function EventCard({ item }: { item: AgendaItem }) {
  return (
    <Link href={`/agenda/evento/?id=${item.id}`} className="pressable lift-on-hover flex flex-col gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="title-3 text-ink-900">{item.name}</span>
          <span className="body-6 text-ink-600">{item.customer}</span>
        </div>
        <EventStatusBadge status={item.status} />
      </div>
      <div className="flex flex-col gap-1 caption-4 text-ink-700">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon size={14} aria-hidden />
          {item.venue}
        </span>
        <span className="tabular-nums">
          Salida {formatTime(item.departureAt)} · Material listo {formatDateTime(item.readyAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {item.shortLines > 0 && (
          <Badge tone="blush" icon={<WarningIcon size={14} weight="fill" aria-hidden />}>
            {item.shortLines === 1 ? "1 artículo con faltante" : `${item.shortLines} artículos con faltante`}
          </Badge>
        )}
        {item.toDispatch > 0 && item.status !== "draft" && <Badge tone="gold">{formatQty(item.toDispatch)} por despachar</Badge>}
        {item.out > 0 && <Badge tone="mist">{formatQty(item.out)} fuera del almacén</Badge>}
        {item.alertCount > 0 && (
          <Badge tone="apricot" icon={<WarningIcon size={14} weight="fill" aria-hidden />}>
            {item.alertCount === 1 ? "1 alerta" : `${item.alertCount} alertas`}
          </Badge>
        )}
        {item.lineCount === 0 && <Badge tone="neutral">Sin artículos</Badge>}
      </div>
    </Link>
  );
}

export function AgendaScreen() {
  const agenda = useLive("agenda", (gateway) => gateway.listAgenda());
  const session = useLive("session", (gateway) => gateway.getSession());
  const canEdit = session.data?.permissions.includes("event.edit") ?? false;
  const groups = agenda.data ? groupByDate(agenda.data) : null;

  return (
    <>
      <PageHeader title="Agenda" description="Eventos por fecha de salida. Abre uno para ver su disponibilidad." />
      {!groups ? (
        <LoadingCards label="Cargando la agenda" />
      ) : groups.length === 0 ? (
        <EmptyState icon={<CalendarDotsIcon size={32} aria-hidden />} title="Todavía no hay eventos">
          Crea un borrador con cliente, lugar, salida prevista y la hora en que el material vuelve a estar listo.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.date} aria-labelledby={`day-${group.date}`} className="flex flex-col gap-2">
              <h2 id={`day-${group.date}`} className="caption-3 text-ink-600">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <EventCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {session.data &&
        (canEdit ? (
          <ActionBar>
            <ButtonLink href="/agenda/nuevo/" variant="primary">
              <PlusIcon size={18} weight="bold" aria-hidden />
              Crear borrador
            </ButtonLink>
          </ActionBar>
        ) : (
          <div className="mt-6">
            <RoleNotice current={session.data.actor.roles[0]!} needed={["coordinator"]} action="crear o editar eventos" />
          </div>
        ))}
    </>
  );
}
