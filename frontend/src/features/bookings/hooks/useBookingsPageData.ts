import { useMemo, useState } from "react";
import { getErrorMessage } from "@/api/errors";
import { useToast } from "@/components/ui/toast";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { downloadCSV } from "@/lib/utils";
import { emitDomainEvent } from "@/lib/domainEvents";
import { withRetry } from "@/lib/retry";
import type { Booking } from "@/types/domain";
import { getBookings, updateBooking } from "@/features/bookings/services/bookingService";
import type { BookingStatusFilter } from "@/features/bookings/components/bookingStatus";

export const BOOKINGS_QUERY_KEY = "bookings:list";

export const useBookingsPageData = () => {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<BookingStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: bookingsData,
    isLoading,
    error,
    refetch,
  } = useResourceQuery<Booking[]>({
    queryKey: BOOKINGS_QUERY_KEY,
    queryFn: getBookings,
    staleTimeMs: 10_000,
  });

  const bookings = useMemo(() => bookingsData ?? [], [bookingsData]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return bookings.filter((booking) => {
      const statusMatches = filterStatus === "all" ? true : booking.status === filterStatus;
      if (!statusMatches) return false;
      if (!normalizedQuery) return true;
      const matchesGuestName = booking.guest_name.toLowerCase().includes(normalizedQuery);
      const matchesId = booking.id.toLowerCase().includes(normalizedQuery);
      return matchesGuestName || matchesId;
    });
  }, [bookings, filterStatus, searchQuery]);

  const refreshBookings = async () => {
    invalidateResource(BOOKINGS_QUERY_KEY);
    await refetch();
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      await withRetry(() => updateBooking(bookingId, { status: "Cancelled" }), { retries: 2 });
      emitDomainEvent("booking_cancelled", { booking_id: bookingId });
      toast({ title: "Reserva cancelada", variant: "success" });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo cancelar la reserva"),
        variant: "error",
      });
    }
  };

  const exportBookings = () => {
    if (bookings.length === 0) {
      toast({ title: "Sin datos", description: "No hay reservas para exportar", variant: "default" });
      return;
    }

    downloadCSV(bookings, `reservas_${new Date().toISOString().split("T")[0]}.csv`);
    toast({ title: "Exportación exitosa", description: "El archivo CSV ha sido generado", variant: "success" });
  };

  return {
    bookings,
    filteredBookings,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    refreshBookings,
    cancelBooking,
    exportBookings,
  };
};
