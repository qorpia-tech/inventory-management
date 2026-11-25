"use client";

import Link from "@/ui/components/app-link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDotsIcon,
  DotsThreeOutlineIcon,
  HouseIcon,
  ListChecksIcon,
  PackageIcon,
  StorefrontIcon,
  TagIcon,
  TruckIcon,
  UsersThreeIcon,
  type Icon,
} from "@phosphor-icons/react";
import { STOREFRONT_SLUGS } from "@/demo/storefront";
import { asset } from "../asset";
import { ROLE_LABEL } from "../copy";
import { formatDateTime } from "../format";
import { useDemo } from "../runtime";
import { cx } from "../components/primitives";
import { DemoPanelProvider, useDemoPanel } from "../demo/demo-panel";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  match: (path: string) => boolean;
}

const startsWith = (...prefixes: string[]) => (path: string) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

const PRIMARY: NavItem[] = [
  { href: "/", label: "Inicio", icon: HouseIcon, match: (p) => p === "" },
  { href: "/agenda/", label: "Agenda", icon: CalendarDotsIcon, match: startsWith("/agenda") },
  { href: "/almacen/", label: "Almacén", icon: TruckIcon, match: startsWith("/almacen") },
  { href: "/inventario/", label: "Inventario", icon: PackageIcon, match: startsWith("/inventario") },
];

const SECONDARY: NavItem[] = [
  { href: "/personal/", label: "Personal", icon: UsersThreeIcon, match: startsWith("/personal") },
  { href: `/c/${STOREFRONT_SLUGS[0]}/`, label: "Web comercial", icon: StorefrontIcon, match: () => false },
  { href: "/planes/", label: "Planes y precios", icon: TagIcon, match: startsWith("/planes") },
];

const MORE: NavItem = {
  href: "/mas/",
  label: "Más",
  icon: DotsThreeOutlineIcon,
  match: startsWith("/mas", "/personal", "/planes"),
};

function usePath(): string {
  const pathname = usePathname() ?? "/";
  return pathname.replace(/\/+$/, "");
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="pressable on-dark flex min-h-11 items-center gap-2 rounded-lg pr-2" aria-label="QorStock, ir al inicio">
      {/* Official isotype, untouched. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/brand/qorpia-q.svg")} alt="" width={26} height={30} className="h-7 w-auto" />
      <span className="flex flex-col leading-none">
        <span className="title-3 text-ivory-50">QorStock</span>
        {!compact && <span className="caption-4 text-petroleum-300">Eventos</span>}
      </span>
    </Link>
  );
}

function DemoButton() {
  const demo = useDemo();
  const panel = useDemoPanel();
  const done = demo?.tour.filter((s) => s.done).length ?? 0;
  return (
    <button
      type="button"
      onClick={panel.open}
      className="pressable on-dark inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold-300/60 bg-petroleum-950/40 px-3 py-1 text-left"
      aria-label={demo ? `Panel de la demo. Viendo como ${ROLE_LABEL[demo.role]}. ${done} de 6 pasos.` : "Panel de la demo"}
    >
      <ListChecksIcon size={20} className="text-gold-300" aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="caption-4 text-petroleum-300">Ver como</span>
        <span className="body-4 text-ivory-50">{demo ? ROLE_LABEL[demo.role] : "…"}</span>
      </span>
      <span className="ml-1 rounded-full bg-gold-300 px-2 py-0.5 caption-4 tabular-nums text-petroleum-950">{done}/6</span>
    </button>
  );
}

function DemoStrip() {
  const demo = useDemo();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 caption-4 text-petroleum-300">
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-300/15 px-2 py-0.5 text-gold-300">Demo con datos ficticios</span>
      {demo && (
        <span className="tabular-nums">Reloj: {formatDateTime(demo.now)}</span>
      )}
    </div>
  );
}

function StaleBanner() {
  const demo = useDemo();
  const panel = useDemoPanel();
  if (!demo?.stale) return null;
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl bg-apricot-100 p-3 text-apricot-800 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="body-6">El escenario de esta demo ya pasó. Reinícialo para preparar el próximo sábado.</p>
      <button type="button" onClick={panel.open} className="pressable min-h-11 rounded-lg bg-white px-3 button-sm text-apricot-800">
        Abrir el panel
      </button>
    </div>
  );
}

function SidebarLink({ item, path }: { item: NavItem; path: string }) {
  const active = item.match(path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "pressable on-dark flex min-h-12 items-center gap-3 rounded-xl px-3 body-5",
        active ? "bg-ivory-50 text-petroleum-950" : "text-ivory-200 [@media(hover:hover)]:hover:bg-petroleum-950/40",
      )}
    >
      <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
      {item.label}
    </Link>
  );
}

function TabBar({ path }: { path: string }) {
  const items = [...PRIMARY, MORE];
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-petroleum-800 bg-petroleum-950 pb-safe md:hidden">
      <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
        {items.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx("pressable on-dark relative flex flex-1 flex-col items-center justify-center gap-1 caption-4", active ? "text-gold-300" : "text-petroleum-300")}
              >
                {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold-300" aria-hidden />}
                <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePath();
  return (
    <DemoPanelProvider>
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-gold-300 text-petroleum-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="bg-petroleum-gradient sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto p-4 md:flex">
          <Brand />
          <nav aria-label="Navegación principal" className="flex flex-col gap-1">
            {PRIMARY.map((item) => (
              <SidebarLink key={item.href} item={item} path={path} />
            ))}
            <p className="caption-3 px-3 pb-1 pt-4 text-petroleum-300">Vistas previas</p>
            {SECONDARY.map((item) => (
              <SidebarLink key={item.href} item={item} path={path} />
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            <DemoButton />
            <DemoStrip />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="bg-petroleum-gradient sticky top-0 z-30 flex flex-col gap-2 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] md:hidden">
            <div className="flex items-center justify-between gap-2">
              <Brand compact />
              <DemoButton />
            </div>
            <DemoStrip />
          </header>
          <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(var(--tabbar-h)+var(--safe-bottom)+24px)] pt-4 md:px-8 md:pb-12 md:pt-8">
            <StaleBanner />
            {children}
          </main>
        </div>
      </div>
      <TabBar path={path} />
    </DemoPanelProvider>
  );
}
