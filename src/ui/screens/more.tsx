"use client";

import Link from "@/ui/components/app-link";
import { ArrowRightIcon, StorefrontIcon, TagIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { STOREFRONT_SLUGS } from "@/demo/storefront";
import { Card, PageHeader } from "../components/primitives";

const LINKS = [
  { href: "/personal/", icon: UsersThreeIcon, title: "Personal y asistencia", text: "Convocatoria de las 16:00 y llegada real de cuatro meseros." },
  { href: `/c/${STOREFRONT_SLUGS[0]}/`, icon: StorefrontIcon, title: "Web comercial", text: "Página pública del catering con consulta editable por WhatsApp." },
  { href: "/planes/", icon: TagIcon, title: "Planes y precios", text: "Precios de QorStock en soles, IGV incluido, por empresa." },
];

export function MoreScreen() {
  return (
    <>
      <PageHeader title="Más" description="Vistas previas y precios." />
      <ul className="flex flex-col gap-2">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} className="pressable flex items-center gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-ivory-200 text-petroleum-700">
                  <Icon size={22} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="title-3 text-ink-900">{item.title}</span>
                  <span className="body-6 text-ink-600">{item.text}</span>
                </span>
                <ArrowRightIcon size={20} className="shrink-0 text-ink-600" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      <Card className="mt-6 flex flex-col gap-2 bg-ivory-100">
        <p className="title-3">Sobre esta demo</p>
        <p className="body-6 text-ink-700">
          Las reglas de inventario corren en tu navegador con datos ficticios: disponibilidad por horario, confirmación con faltantes, despacho, devolución por partes,
          lavado y atrasos. Nada se envía a un servidor.
        </p>
      </Card>
    </>
  );
}
