import { Download, Filter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_FILTER_OPTIONS,
  type BookingStatusFilter,
  getStatusBadgeLabel,
} from "@/features/bookings/components/bookingStatus";

type BookingsFiltersToolbarProps = {
  filterStatus: BookingStatusFilter;
  onFilterChange: (status: BookingStatusFilter) => void;
  onExport: () => void;
  onCreateBooking: () => void;
};

const BookingsFiltersToolbar = ({
  filterStatus,
  onFilterChange,
  onExport,
  onCreateBooking,
}: BookingsFiltersToolbarProps) => (
  <div className="flex gap-3">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-10 rounded-xl border-slate-200 dark:border-slate-700",
            filterStatus !== "all" && "border-indigo-200 bg-indigo-50 text-indigo-700",
          )}
        >
          <Filter className="mr-2 h-4 w-4" />
          {getStatusBadgeLabel(filterStatus)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900">
        {BOOKING_STATUS_FILTER_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onFilterChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>

    <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 dark:border-slate-700" onClick={onExport}>
      <Download className="mr-2 h-4 w-4" /> Exportar
    </Button>

    <Button size="sm" className="h-10 rounded-xl bg-slate-900 shadow-lg shadow-slate-200" onClick={onCreateBooking}>
      <Plus className="mr-2 h-4 w-4" /> Nueva Reserva
    </Button>
  </div>
);

export default BookingsFiltersToolbar;
