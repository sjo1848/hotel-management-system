import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/ui/data-table";
import type { Booking } from "@/types/domain";
import BookingDetailsSheet from "@/features/bookings/components/BookingDetailsSheet";
import BookingEditDrawer from "@/features/bookings/components/BookingEditDrawer";
import BookingsFiltersToolbar from "@/features/bookings/components/BookingsFiltersToolbar";
import { buildBookingsColumns } from "@/features/bookings/components/bookingsColumns";
import { useBookingsPageData } from "@/features/bookings/hooks/useBookingsPageData";

const BookingsPage = () => {
  const navigate = useNavigate();
  const {
    filteredBookings,
    filterStatus,
    setFilterStatus,
    setSearchQuery,
    isLoading,
    error,
    refreshBookings,
    cancelBooking,
    exportBookings,
  } = useBookingsPageData();

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const columns = useMemo(
    () =>
      buildBookingsColumns({
        onViewDetails: (booking) => {
          setSelectedBooking(booking);
          setIsDetailsOpen(true);
        },
        onEditStatus: (booking) => {
          setSelectedBooking(booking);
          setIsEditOpen(true);
        },
        onCancelBooking: (bookingId) => {
          void cancelBooking(bookingId);
        },
      }),
    [cancelBooking],
  );

  return (
    <div className="animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-black leading-none tracking-tight text-slate-900 dark:text-slate-100">Reservas</h2>
          <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">Gestión de estancias y disponibilidad.</p>
        </div>

        <BookingsFiltersToolbar
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          onExport={exportBookings}
          onCreateBooking={() => navigate("/rooms")}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50">
        {error ? (
          <div className="border-b border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <DataTable
          columns={columns}
          data={filteredBookings}
          isLoading={isLoading}
          searchable
          searchPlaceholder="Buscar por huésped o ID..."
          onSearch={setSearchQuery}
        />
      </div>

      {selectedBooking ? (
        <>
          <BookingEditDrawer
            booking={selectedBooking}
            isOpen={isEditOpen}
            onClose={() => {
              setIsEditOpen(false);
              setSelectedBooking(null);
            }}
            onSuccess={refreshBookings}
            onViewDetails={() => setIsDetailsOpen(true)}
          />
          <BookingDetailsSheet
            booking={selectedBooking}
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false);
              setSelectedBooking(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
};

export default BookingsPage;
