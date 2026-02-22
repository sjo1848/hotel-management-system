import { useMemo, useState } from "react";
import { MoreVertical, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBookings, updateBooking } from "../services/bookingService";
import { Booking } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import BookingEditDrawer from "./BookingEditDrawer";
import { getErrorMessage } from "@/api/errors";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { withRetry } from "@/lib/retry";
import { emitDomainEvent } from "@/lib/domainEvents";

const RECENT_BOOKINGS_QUERY_KEY = "bookings:list:recent";

const BookingList = () => {
  const { toast } = useToast();

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const {
    data: recentBookingsData,
    isLoading: loading,
    error,
  } = useResourceQuery<Booking[]>({
    queryKey: RECENT_BOOKINGS_QUERY_KEY,
    queryFn: getBookings,
    staleTimeMs: 8_000,
  });

  const bookings = useMemo(
    () => (recentBookingsData ?? []).slice(0, 10),
    [recentBookingsData],
  );

  const handleCancel = async (booking: Booking) => {
    if (booking.status === "Cancelled") return;

    try {
      await withRetry(() => updateBooking(booking.id, { status: "Cancelled" }), { retries: 2 });
      emitDomainEvent("booking_cancelled", { booking_id: booking.id });
      toast({
        title: "Reserva cancelada",
        variant: "success",
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(err, "No se pudo cancelar la reserva."),
        variant: "error",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge variant="info">Confirmada</Badge>;
      case "CheckedIn":
        return <Badge variant="success">Check-in</Badge>;
      case "CheckedOut":
        return <Badge variant="neutral">Finalizada</Badge>;
      case "Cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-10">
        <CheckCircle2 className="h-8 w-8 animate-pulse text-slate-300 dark:text-slate-500" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Actualizando reservas...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertCircle className="mb-2 h-10 w-10 text-rose-400 dark:text-rose-300" />
        <p className="text-sm font-bold text-rose-700 dark:text-rose-200">No se pudo cargar la actividad reciente</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <AlertCircle className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-500" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No hay actividad reciente</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-transparent dark:border-slate-800 dark:bg-slate-900/50">
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Huésped
              </TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Estado
              </TableHead>
              <TableHead className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Fechas
              </TableHead>
              <TableHead className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Monto
              </TableHead>
              <TableHead className="px-6 py-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow
                key={booking.id}
                className="group border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <TableCell className="px-6 py-4">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{booking.guest_name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-500 dark:text-slate-400">
                    Hab {booking.room_id.slice(0, 4)}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4">{getStatusBadge(booking.status)}</TableCell>
                <TableCell className="px-6 py-4">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{booking.check_in}</div>
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">al {booking.check_out}</div>
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    ${(booking.total_price_cents / 100).toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-slate-500 opacity-0 transition-all hover:bg-slate-100 hover:shadow-md group-hover:opacity-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <MoreVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl dark:border-slate-800">
                      <DropdownMenuItem
                        className="text-xs font-bold"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsEditOpen(true);
                        }}
                      >
                        Gestionar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-xs font-bold text-rose-600 dark:text-rose-200"
                        disabled={booking.status === "Cancelled" || booking.status === "CheckedOut"}
                        onClick={() => void handleCancel(booking)}
                      >
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BookingEditDrawer
        booking={selectedBooking}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => emitDomainEvent("booking_updated")}
      />
    </>
  );
};

export default BookingList;
