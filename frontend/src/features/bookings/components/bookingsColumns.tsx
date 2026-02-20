import { MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Column } from "@/components/ui/data-table";
import type { Booking } from "@/types/domain";
import { renderBookingStatusBadge } from "@/features/bookings/components/bookingStatus";

type BuildBookingsColumnsOptions = {
  onViewDetails: (booking: Booking) => void;
  onEditStatus: (booking: Booking) => void;
  onCancelBooking: (bookingId: string) => void;
};

export const buildBookingsColumns = ({
  onViewDetails,
  onEditStatus,
  onCancelBooking,
}: BuildBookingsColumnsOptions): Column<Booking>[] => [
  {
    header: "Huésped",
    cell: (item) => (
      <div>
        <div className="font-bold text-slate-900 dark:text-slate-100">{item.guest_name}</div>
        <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">ID: {item.id.slice(0, 8)}</div>
      </div>
    ),
  },
  {
    header: "Habitación",
    accessorKey: "room_id",
    cell: (item) => (
      <Badge variant="outline" className="font-mono">
        Room {item.room_id.slice(0, 4)}
      </Badge>
    ),
  },
  {
    header: "Check-in",
    accessorKey: "check_in",
  },
  {
    header: "Check-out",
    accessorKey: "check_out",
  },
  {
    header: "Total",
    cell: (item) => (
      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">${(item.total_price_cents / 100).toLocaleString()}</span>
    ),
  },
  {
    header: "Estado",
    cell: (item) => renderBookingStatusBadge(item.status),
  },
  {
    header: "",
    className: "w-[120px]",
    cell: (item) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-xs font-bold text-indigo-600 dark:text-indigo-200" onClick={() => onViewDetails(item)}>
          Detalles
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditStatus(item)}>Editar Estado</DropdownMenuItem>
            {item.status !== "Cancelled" && item.status !== "CheckedOut" ? (
              <DropdownMenuItem className="text-red-600 dark:text-red-200" onClick={() => onCancelBooking(item.id)}>
                Cancelar Reserva
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];
