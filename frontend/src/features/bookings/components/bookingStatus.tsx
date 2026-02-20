import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import type { BookingStatus } from "@/types/domain";

export type BookingStatusFilter = "all" | BookingStatus;

export const BOOKING_STATUS_FILTER_OPTIONS: Array<{ value: BookingStatusFilter; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "Confirmed", label: "Confirmadas" },
  { value: "CheckedIn", label: "En el Hotel" },
  { value: "CheckedOut", label: "Finalizadas" },
  { value: "Cancelled", label: "Canceladas" },
];

export const getStatusBadgeLabel = (status: BookingStatusFilter) => {
  if (status === "all") return "Filtros";
  return `Estado: ${status}`;
};

export const renderBookingStatusBadge = (status: BookingStatus) => {
  switch (status) {
    case "Confirmed":
      return (
        <Badge variant="info" className="gap-1">
          <Clock className="h-3 w-3" /> Confirmada
        </Badge>
      );
    case "CheckedIn":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" /> Check-in
        </Badge>
      );
    case "CheckedOut":
      return (
        <Badge variant="neutral" className="gap-1">
          <CheckCircle className="h-3 w-3" /> Finalizada
        </Badge>
      );
    case "Cancelled":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Cancelada
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
