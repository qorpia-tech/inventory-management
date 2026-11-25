import { fromLima } from "@/lib/lima-time";
import type { DemoRefs } from "./seed";

/** Staff and attendance is a read-only preview with fictional data (design §6.6). */
export interface StaffWorker {
  id: string;
  name: string;
  role: string;
  expectedAt: number;
  /** Real arrival; null when nobody registered it. */
  arrivedAt: number | null;
}

export interface StaffCallView {
  eventId: string;
  callAt: number;
  /** Example tolerance: the real rule is an open decision with the client (spec §7). */
  toleranceMinutes: number;
  workers: StaffWorker[];
}

export type ArrivalStatus = { kind: "on_time" } | { kind: "late"; minutes: number } | { kind: "no_record" };

export function getStaffCall(refs: DemoRefs): StaffCallView {
  const callAt = fromLima(refs.saturday, "16:00");
  const at = (time: string) => fromLima(refs.saturday, time);
  return {
    eventId: refs.weddingId,
    callAt,
    toleranceMinutes: 10,
    workers: [
      { id: "w-1", name: "Kevin Arana", role: "Mesero", expectedAt: callAt, arrivedAt: at("15:48") },
      { id: "w-2", name: "Milagros Cueva", role: "Mesera", expectedAt: callAt, arrivedAt: at("15:56") },
      { id: "w-3", name: "Renzo Valdivia", role: "Mesero", expectedAt: callAt, arrivedAt: at("16:12") },
      { id: "w-4", name: "Sofía Llerena", role: "Mesera", expectedAt: callAt, arrivedAt: null },
    ],
  };
}

export function arrivalStatus(worker: StaffWorker, toleranceMinutes: number): ArrivalStatus {
  if (worker.arrivedAt === null) return { kind: "no_record" };
  const minutes = Math.round((worker.arrivedAt - worker.expectedAt) / 60000);
  return minutes > toleranceMinutes ? { kind: "late", minutes } : { kind: "on_time" };
}
