"use client";

import { useEffect } from "react";
import { ClockIcon, MapPinIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { arrivalStatus } from "@/demo/staff";
import { formatLongDate, formatTime } from "../format";
import { useDemoControls, useLive } from "../runtime";
import { RoleNotice } from "../components/domain-bits";
import { Badge, Card, EmptyState, LoadingCards, PageHeader, SectionTitle } from "../components/primitives";

export function StaffScreen() {
  const controls = useDemoControls();
  const call = useLive("staff", (g) => g.getStaffCall());
  const session = useLive("session", (g) => g.getSession());
  const canView = session.data?.permissions.includes("staff.view") ?? false;

  useEffect(() => {
    if (controls && canView) controls.markVisited("staffOpened");
  }, [controls, canView]);

  return (
    <>
      <PageHeader
        title="Personal y asistencia"
        description="Vista previa con datos ficticios: convocatoria y llegada real por evento."
        aside={<Badge tone="gold">Vista previa</Badge>}
      />
      {!session.data || call.loading ? (
        <LoadingCards count={1} label="Cargando la convocatoria" />
      ) : !canView ? (
        <RoleNotice current={session.data.actor.roles[0]!} needed={["coordinator", "admin"]} action="ver la convocatoria y la asistencia" />
      ) : !call.data ? (
        <EmptyState icon={<UsersThreeIcon size={32} aria-hidden />} title="No hay convocatorias" />
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <p className="title-3 text-ink-900">{call.data.eventName}</p>
            <p className="inline-flex items-center gap-2 body-6 text-ink-700">
              <MapPinIcon size={16} aria-hidden />
              {call.data.venue}
            </p>
            <p className="inline-flex items-center gap-2 body-4 tabular-nums text-ink-900">
              <ClockIcon size={16} aria-hidden />
              Convocatoria: {formatLongDate(call.data.callAt)}, {formatTime(call.data.callAt)}
            </p>
          </Card>

          <SectionTitle>Meseros convocados</SectionTitle>
          <ul className="flex flex-col gap-2">
            {call.data.workers.map((worker) => {
              const status = arrivalStatus(worker, call.data!.toleranceMinutes);
              return (
                <Card as="li" key={worker.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="title-3 text-ink-900">{worker.name}</p>
                    <p className="caption-4 tabular-nums text-ink-600">
                      {worker.role} · esperado {formatTime(worker.expectedAt)} · {worker.arrivedAt === null ? "sin marca de llegada" : `llegó ${formatTime(worker.arrivedAt)}`}
                    </p>
                  </div>
                  {status.kind === "on_time" && <Badge tone="sage">A tiempo</Badge>}
                  {status.kind === "late" && <Badge tone="apricot">{status.minutes} min tarde</Badge>}
                  {status.kind === "no_record" && <Badge tone="blush">Sin registro</Badge>}
                </Card>
              );
            })}
          </ul>
          <p className="mt-3 caption-4 text-ink-600">
            Tolerancia de ejemplo: {call.data.toleranceMinutes} minutos. La regla real de tardanza y quién valida la llegada se definen con el cliente. Un mesero eventual
            puede figurar sin cuenta de acceso.
          </p>
        </>
      )}
    </>
  );
}
