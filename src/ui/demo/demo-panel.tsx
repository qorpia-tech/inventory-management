"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwiseIcon, ArrowRightIcon, CheckIcon, ClockCountdownIcon, FastForwardIcon, InfoIcon } from "@phosphor-icons/react";
import type { Role } from "@/application/gateway";
import { DAY_MS, HOUR_MS } from "@/lib/lima-time";
import { ROLE_HINT, ROLE_LABEL } from "../copy";
import { formatDateTime } from "../format";
import { useDemo, useDemoControls } from "../runtime";
import { Button, cx, Notice } from "../components/primitives";
import { Sheet } from "../components/sheet";
import { overdueMoment, TOUR_STEPS } from "./tour";

const PanelContext = createContext<{ open: () => void }>({ open: () => {} });

export function useDemoPanel() {
  return useContext(PanelContext);
}

const ROLES: Role[] = ["coordinator", "warehouse", "admin"];

export function DemoPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PanelContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <DemoPanel open={open} onClose={() => setOpen(false)} />
    </PanelContext.Provider>
  );
}

function DemoPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const demo = useDemo();
  const controls = useDemoControls();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  if (!demo || !controls) return null;
  const doneCount = demo.tour.filter((s) => s.done).length;
  const current = demo.tour.find((s) => !s.done)?.step;
  const isAdmin = demo.role === "admin";
  const overdueAt = overdueMoment(demo.refs);

  const goTo = (role: Role, href: string) => {
    controls.setRole(role);
    onClose();
    router.push(href);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Panel de la demo" description="Demo con datos ficticios. Todo se guarda solo en este navegador.">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="demo-tour" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="demo-tour" className="title-3">
              Recorrido guiado
            </h3>
            <span className="caption-4 text-ink-600">
              {doneCount} de {TOUR_STEPS.length} pasos
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ivory-200" aria-hidden>
            <div className="h-full origin-left rounded-full bg-gold-500 transition-transform duration-300 ease-out-strong" style={{ transform: `scaleX(${doneCount / TOUR_STEPS.length})` }} />
          </div>
          <ol className="flex flex-col gap-2">
            {TOUR_STEPS.map((step) => {
              const done = demo.tour.find((s) => s.step === step.step)?.done ?? false;
              const isCurrent = step.step === current;
              return (
                <li key={step.step} className={cx("flex flex-col gap-2 rounded-xl border p-3", isCurrent ? "border-gold-500 bg-gold-100" : "border-ivory-300 bg-white")}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-full title-4",
                        done ? "bg-sage-100 text-sage-800" : "bg-ivory-200 text-ink-700",
                      )}
                      aria-hidden
                    >
                      {done ? <CheckIcon size={16} weight="bold" /> : step.step}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="title-4 text-ink-900">
                        <span className="sr-only">{done ? "Hecho. " : isCurrent ? "Paso actual. " : ""}</span>
                        Paso {step.step}. {step.title}
                      </p>
                      <p className="caption-4 text-ink-600">{step.result}</p>
                      <p className="caption-4 text-ink-600">Rol: {ROLE_LABEL[step.role]}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={isCurrent ? "dark" : "secondary"} onClick={() => goTo(step.role, step.href(demo.refs))}>
                    {done ? "Volver a ver" : "Ir al paso"}
                    <ArrowRightIcon size={16} aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-ivory-300 p-3">
            <p className="title-4 text-ink-900">Opcional: un atraso</p>
            <p className="caption-4 text-ink-600">
              Después del paso 3 y antes de recibir, adelanta el reloj al domingo 13:00. La boda queda atrasada y la cena del domingo muestra el conflicto.
            </p>
            <Button size="sm" variant="secondary" disabled={demo.now >= overdueAt} onClick={() => controls.jumpClockTo(overdueAt)}>
              <ClockCountdownIcon size={16} aria-hidden />
              Adelantar al domingo 13:00
            </Button>
          </div>
        </section>

        <section aria-labelledby="demo-role" className="flex flex-col gap-2">
          <h3 id="demo-role" className="title-3">
            Ver como
          </h3>
          <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="demo-role">
            {ROLES.map((role) => {
              const active = demo.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => controls.setRole(role)}
                  className={cx(
                    "pressable flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left",
                    active ? "border-petroleum-700 bg-petroleum-700 text-ivory-50" : "border-ivory-300 bg-white text-ink-900",
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="title-3">{ROLE_LABEL[role]}</span>
                    <span className={cx("caption-4", active ? "text-ivory-200" : "text-ink-600")}>{ROLE_HINT[role]}</span>
                  </span>
                  {active && <CheckIcon size={20} weight="bold" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="demo-clock" className="flex flex-col gap-2">
          <h3 id="demo-clock" className="title-3">
            Reloj de la demo
          </h3>
          <p className="body-5 text-ink-900">
            Ahora: <span className="tabular-nums">{formatDateTime(demo.now)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => controls.advanceClock(HOUR_MS)}>
              <FastForwardIcon size={16} aria-hidden />
              Una hora
            </Button>
            <Button size="sm" variant="secondary" onClick={() => controls.advanceClock(DAY_MS)}>
              <FastForwardIcon size={16} aria-hidden />
              Un día
            </Button>
          </div>
          <p className="caption-4 text-ink-600">El reloj solo avanza. Al reiniciar la demo vuelve a la hora real.</p>
        </section>

        <section aria-labelledby="demo-reset" className="flex flex-col gap-2">
          <h3 id="demo-reset" className="title-3">
            Reiniciar demo
          </h3>
          {resetDone && <Notice tone="success">Escenario restaurado. El sábado de la demo vuelve a empezar.</Notice>}
          {!isAdmin && (
            <p className="flex items-start gap-2 caption-4 text-ink-600">
              <InfoIcon size={16} className="mt-0.5 shrink-0" aria-hidden />
              Solo el administrador puede reiniciar. Cambia a Administrador arriba.
            </p>
          )}
          {confirmReset ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmReset(false)}>
                Volver
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const result = controls.reset();
                  setConfirmReset(false);
                  setResetDone(result.ok);
                }}
              >
                Sí, reiniciar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" disabled={!isAdmin} onClick={() => setConfirmReset(true)}>
              <ArrowCounterClockwiseIcon size={18} aria-hidden />
              Reiniciar demo
            </Button>
          )}
        </section>
      </div>
    </Sheet>
  );
}
