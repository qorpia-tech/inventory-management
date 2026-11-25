"use client";

import Link from "@/ui/components/app-link";
import { ArrowRightIcon, CalendarDotsIcon, PackageIcon, PlayIcon, TagIcon, TruckIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { DEMO_COMPANY } from "@/demo/seed";
import { asset } from "../asset";
import { formatLongDate, formatTime } from "../format";
import { useDemo, useLive } from "../runtime";
import { AlertList, EventStatusBadge } from "../components/domain-bits";
import { buttonClass, Card, LoadingCards, SectionTitle } from "../components/primitives";
import { useDemoPanel } from "../demo/demo-panel";

const SCREENS = [
  { href: "/agenda/", icon: CalendarDotsIcon, title: "Agenda y reservas", text: "Eventos por fecha, disponibilidad por horario y confirmación con faltantes." },
  { href: "/almacen/", icon: TruckIcon, title: "Despacho y devolución", text: "Desde el celular: salida, recepción por partes, roturas y lavado." },
  { href: "/inventario/", icon: PackageIcon, title: "Inventario", text: "Existencias por estado, ingresos, ajustes con motivo e historial." },
  { href: "/personal/", icon: UsersThreeIcon, title: "Personal y asistencia", text: "Vista previa de la convocatoria y la llegada real de los meseros." },
  { href: "/planes/", icon: TagIcon, title: "Planes y precios", text: "Lo que cuesta QorStock para tu empresa, con IGV incluido." },
];

export function HomeScreen() {
  const demo = useDemo();
  const panel = useDemoPanel();
  const agenda = useLive("agenda", (gateway) => gateway.listAgenda());
  const alerts = useLive("alerts", (gateway) => gateway.listAlerts());
  const done = demo?.tour.filter((s) => s.done).length ?? 0;
  const upcoming = agenda.data?.filter((e) => e.status !== "closed" && e.status !== "cancelled").slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-petroleum-gradient on-dark relative overflow-hidden rounded-3xl p-6 text-ivory-50 md:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/brand/qorpia-q.svg")} alt="" aria-hidden className="pointer-events-none absolute -right-8 -top-6 h-48 w-auto opacity-10" />
        <p className="caption-3 text-gold-300">Demo con datos ficticios</p>
        <h1 className="heading-5 md:heading-3 mt-2 max-w-[680px]">
          Sabe qué tienes, dónde está
          <br /> y quién lo movió.
        </h1>
        <p className="body-3 mt-3 max-w-[560px] text-ivory-200">
          {DEMO_COMPANY.name} es un catering ficticio que prepara un sábado con dos eventos que se cruzan. Recorre los seis pasos del guion desde tu celular.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={panel.open} className={buttonClass("primary")}>
            <PlayIcon size={18} weight="fill" aria-hidden />
            {done === 0 ? "Empezar el recorrido" : `Seguir el recorrido (${done} de 6)`}
          </button>
          <Link href="/planes/" className={buttonClass("outlineLight")}>
            Ver planes y precios
          </Link>
        </div>
      </section>

      {alerts.data && alerts.data.length > 0 && (
        <section aria-labelledby="home-alerts">
          <SectionTitle id="home-alerts">Alertas</SectionTitle>
          <AlertList alerts={alerts.data} />
        </section>
      )}

      <section aria-labelledby="home-next">
        <SectionTitle id="home-next" aside={<Link href="/agenda/" className="inline-flex min-h-11 items-center body-5 text-petroleum-700 underline-offset-2 [@media(hover:hover)]:hover:underline">Ver agenda</Link>}>
          Próximos eventos
        </SectionTitle>
        {!upcoming ? (
          <LoadingCards count={2} label="Cargando eventos" />
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link href={`/agenda/evento/?id=${event.id}`} className="pressable flex items-center justify-between gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="title-3 text-ink-900">{event.name}</span>
                    <span className="caption-4 text-ink-600">
                      {formatLongDate(event.departureAt)} · salida {formatTime(event.departureAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <EventStatusBadge status={event.status} />
                    <ArrowRightIcon size={18} className="text-ink-600" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-screens">
        <SectionTitle id="home-screens">Qué puedes ver</SectionTitle>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SCREENS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} className="pressable lift-on-hover flex h-full items-start gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-ivory-200 text-petroleum-700">
                    <Icon size={22} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="title-3 text-ink-900">{item.title}</span>
                    <span className="body-6 text-ink-600">{item.text}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="bg-ivory-100">
        <p className="body-6 text-ink-700">
          Todo lo que registres queda guardado solo en este navegador. El administrador puede reiniciar el escenario desde el panel de la demo.
        </p>
      </Card>
    </div>
  );
}
