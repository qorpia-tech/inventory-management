import type { Bucket, DomainError, DomainErrorCode, EventStatus, MovementKind, Role } from "@/application/gateway";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coordinator: "Coordinador",
  warehouse: "Almacén",
};

export const ROLE_HINT: Record<Role, string> = {
  admin: "Catálogo, saldos, ajustes y reinicio de la demo",
  coordinator: "Agenda, reservas, confirmación y cierre",
  warehouse: "Despacho, devolución y lavado",
};

export const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  in_progress: "En curso",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  opening: "Saldo inicial",
  receipt: "Ingreso",
  adjustment: "Ajuste",
  dispatch: "Despacho",
  return: "Devolución",
  washing_release: "Liberación de lavado",
  washing_loss: "Baja en lavado",
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  available: "disponible",
  washing: "lavado",
  out: "fuera",
  opening: "saldo inicial",
  purchase: "compra",
  adjustment: "ajuste",
  broken: "roto",
  lost: "perdido",
  consumed: "consumido",
};

const ERROR_MESSAGE: Record<DomainErrorCode, string> = {
  forbidden: "Tu rol actual no puede hacer esta operación. Cambia de rol en el panel de la demo.",
  not_found: "No encontramos ese registro. Vuelve a la lista y ábrelo de nuevo.",
  validation: "Revisa los campos marcados.",
  invalid_quantity: "Ingresa una cantidad entera mayor que cero.",
  reason_required: "Escribe el motivo. Es obligatorio para roturas, pérdidas y ajustes.",
  invalid_dates: "La hora en que el material vuelve a estar listo debe ser posterior a la salida y estar en el futuro.",
  invalid_state: "El evento cambió de estado. Revisa su situación actual.",
  stale_version: "Otra persona modificó este evento. Ya cargamos la versión actual; revisa y vuelve a intentarlo.",
  duplicate_sku: "Ya existe un artículo con ese código.",
  duplicate_line: "Ese artículo ya está en la lista.",
  opening_exists: "Este artículo ya tiene movimientos. Usa un ingreso o un ajuste.",
  shortage: "No se confirmó: falta stock. El borrador sigue igual.",
  over_dispatch: "La cantidad supera lo que queda por despachar.",
  insufficient_stock: "No hay suficientes unidades disponibles en el almacén.",
  insufficient_availability: "No alcanza el stock para despachar antes de la salida prevista.",
  reservation_expired: "La reserva ya venció. El coordinador debe mover las fechas o liberar el saldo.",
  unresolved_conflict: "Hay un conflicto sin resolver: ese artículo quedó corto en el horario de este evento.",
  over_receipt: "La devolución supera lo pendiente. No se registró nada; corrige las cantidades.",
  consumable_return: "Los descartables no se devuelven: se consumen al despachar.",
  nothing_to_register: "No hay cantidades para registrar.",
  close_blocked: "Todavía no se puede cerrar: hay material por despachar o por devolver.",
  cancel_blocked: "No se puede cancelar un evento con material despachado. Libera lo no despachado y recibe lo que salió.",
  batch_exceeded: "La cantidad supera lo que queda en ese lote de lavado.",
  creates_shortage: "Este ajuste deja eventos sin stock.",
  idempotency_mismatch: "La operación ya se registró con otros datos. Recarga la pantalla.",
};

export function errorMessage(error: DomainError): string {
  return ERROR_MESSAGE[error.code];
}
