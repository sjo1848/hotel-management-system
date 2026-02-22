import type { BookingStatus } from "@/types/domain";

type BookingStatusMeta = {
  label: string;
  shortLabel: string;
};

const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  Confirmed: { label: "Confirmada", shortLabel: "Confirmada" },
  CheckedIn: { label: "En el Hotel", shortLabel: "Check-in" },
  CheckedOut: { label: "Finalizada", shortLabel: "Finalizada" },
  Cancelled: { label: "Cancelada", shortLabel: "Cancelada" },
};

export const getBookingStatusMeta = (status: BookingStatus): BookingStatusMeta =>
  BOOKING_STATUS_META[status];

export const getTransitionSuccessMessage = (status: BookingStatus) => {
  switch (status) {
    case "CheckedIn":
      return "Check-in completado y habitación marcada como ocupada.";
    case "CheckedOut":
      return "Check-out completado y factura emitida para la estancia.";
    case "Cancelled":
      return "Reserva cancelada correctamente.";
    case "Confirmed":
    default:
      return "Estado actualizado correctamente.";
  }
};

export const getTransitionFallbackError = (status: BookingStatus) => {
  switch (status) {
    case "CheckedIn":
      return "No se pudo registrar el check-in.";
    case "CheckedOut":
      return "No se pudo registrar el check-out.";
    case "Cancelled":
      return "No se pudo cancelar la reserva.";
    case "Confirmed":
    default:
      return "No se pudo actualizar el estado de la reserva.";
  }
};
