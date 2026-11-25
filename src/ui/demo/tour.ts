import type { Role } from "@/application/gateway";
import type { DemoRefs } from "@/demo/seed";
import { addDays, fromLima } from "@/lib/lima-time";

export interface TourStepDef {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  result: string;
  role: Role;
  href: (refs: DemoRefs) => string;
}

/** The six steps of spec §5, with the verifiable result of each one. */
export const TOUR_STEPS: TourStepDef[] = [
  {
    step: 1,
    title: "Abre la boda y consulta 100 copas",
    result: "Aparecen 90 disponibles y faltan 10. La boda sigue en borrador.",
    role: "coordinator",
    href: (refs) => `/agenda/evento/?id=${refs.weddingId}`,
  },
  {
    step: 2,
    title: "Cambia a 90 y confirma",
    result: "Se reservan 90. Otro evento en la misma franja encuentra cero copas libres.",
    role: "coordinator",
    href: (refs) => `/agenda/evento/?id=${refs.weddingId}`,
  },
  {
    step: 3,
    title: "Despacha las 90 desde el celular",
    result: "El evento muestra 90 fuera del almacén. Recargar conserva el registro.",
    role: "warehouse",
    href: (refs) => `/almacen/evento/?id=${refs.weddingId}&modo=despacho`,
  },
  {
    step: 4,
    title: "Recibe 86 sanas y registra 2 rotas",
    result: "Quedan 2 pendientes. El evento sigue abierto.",
    role: "warehouse",
    href: (refs) => `/almacen/evento/?id=${refs.weddingId}&modo=devolucion`,
  },
  {
    step: 5,
    title: "Recibe las últimas 2 para lavado",
    result: "El saldo pendiente baja a cero. Se puede cerrar y quedan 2 en lavado vinculadas a esta devolución.",
    role: "warehouse",
    href: (refs) => `/almacen/evento/?id=${refs.weddingId}&modo=devolucion`,
  },
  {
    step: 6,
    title: "Abre la asistencia y la web comercial",
    result: "La convocatoria de las 16:00 muestra una llegada a las 16:12 y otra persona sin registro. La web abre una consulta editable por WhatsApp.",
    role: "coordinator",
    href: () => "/personal/",
  },
];

/** Optional extra: the instant after the wedding's planned return, to show the overdue alert. */
export function overdueMoment(refs: DemoRefs): number {
  return fromLima(addDays(refs.saturday, 1), "13:00");
}
