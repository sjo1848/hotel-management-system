import { useState } from "react";
import { Hotel, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Booking,
  BookingFrontDeskData,
  BookingStatus,
  FrontDeskQueueItem,
} from "@/types/domain";
import type { ReceptionGuideStepId } from "@/features/guided/receptionGuide";
import BookingCaseWorkspace from "./BookingCaseWorkspace";
import { ReceptionQueueList } from "./ReceptionQueueList";
import { filterCockpitQueue } from "@/features/bookings/utils/cockpitQueue";

type ReceptionShiftViewProps = {
  items: FrontDeskQueueItem[];
  selectedBooking: Booking | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenCase: (bookingId: string) => void;
  onPrepareCheckIn: (bookingId: string) => void;
  onCloseCase: () => void;
  queueBookingIds: string[];
  onOpenQueuedBooking: (bookingId: string) => void;
  guidedFocusStep: ReceptionGuideStepId | null;
  onUpdateStatus?: (
    id: string,
    status: BookingStatus,
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => Promise<void>;
  onEditBooking?: () => void;
  onRefreshBooking?: () => Promise<void> | void;
};

export const ReceptionShiftView = ({
  items,
  selectedBooking,
  loading,
  error,
  onRetry,
  onOpenCase,
  onPrepareCheckIn,
  onCloseCase,
  queueBookingIds,
  onOpenQueuedBooking,
  guidedFocusStep,
  onUpdateStatus,
  onEditBooking,
  onRefreshBooking,
}: ReceptionShiftViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const firstCase = items[0]?.entry.booking_id;
  const visibleItems =
    searchQuery.trim().length > 0
      ? filterCockpitQueue({
          queue: items,
          searchQuery,
          queueFilter: "all",
          laneIds: {
            readyArrivalIds: new Set(),
            blockedArrivalIds: new Set(),
            departureIds: new Set(),
            inHouseIds: new Set(),
          },
        })
      : items;
  const noMatches = searchQuery.trim().length > 0 && visibleItems.length === 0;

  return (
    <section id="front-desk-board" className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0 xl:max-h-[calc(100vh-16rem)] xl:overflow-y-auto xl:pr-1">
        <div className="mb-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm">
          <label
            htmlFor="shift-view-search"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Buscar en el turno
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="shift-view-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Huesped, habitacion o reserva"
              className="h-11 w-full rounded-2xl border border-input bg-card pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <ReceptionQueueList
          items={visibleItems}
          selectedBookingId={selectedBooking?.id}
          loading={loading}
          error={error}
          emptyMessage={
            noMatches
              ? "No hay casos que coincidan con la busqueda y el filtro actuales."
              : "No hay casos pendientes para esta fecha"
          }
          onRetry={onRetry}
          onOpen={onOpenCase}
          onPrepareCheckIn={onPrepareCheckIn}
          ariaLabel="Cola del turno"
          summaryText={`Mostrando ${visibleItems.length} casos del turno`}
        />
      </div>

      <div className="min-w-0">
        {selectedBooking ? (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm xl:max-h-[calc(100vh-16rem)]">
            <BookingCaseWorkspace
              booking={selectedBooking}
              isOpen
              onClose={onCloseCase}
              onUpdateStatus={onUpdateStatus}
              onEditBooking={onEditBooking}
              onRefreshBooking={onRefreshBooking}
              queueBookingIds={queueBookingIds}
              onOpenQueuedBooking={onOpenQueuedBooking}
              guidedFocusStep={guidedFocusStep}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center xl:max-h-[calc(100vh-16rem)]">
            <Hotel className="h-8 w-8 text-primary" />
            <h3 className="text-lg font-black tracking-tight text-foreground">Foco del turno</h3>
            <p className="max-w-[52ch] text-sm text-muted-foreground">
              {items.length > 0
                ? `${items.length} caso(s) esperando atención. Seleccioná uno para ver su detalle y la próxima acción.`
                : "No hay casos pendientes para esta fecha."}
            </p>
            {firstCase ? (
              <Button type="button" className="h-10 rounded-xl" onClick={() => onOpenCase(firstCase)}>
                Abrir primer caso
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
