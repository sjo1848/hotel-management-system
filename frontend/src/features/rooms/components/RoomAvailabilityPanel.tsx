import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room } from "@/types/domain";
import { getRoomStatusBadge } from "./roomPresentation";
import AvailabilityPicker from "./AvailabilityPicker";

export type RoomAvailabilityPanelProps = {
  dates: { from: string; to: string } | null;
  isLoading: boolean;
  error: string | null;
  availableRooms: Room[];
  canCreateBooking: boolean;
  onSearch: (from: string, to: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onReserve: (room: Room) => void;
};

export const RoomAvailabilityPanel = ({
  dates,
  isLoading,
  error,
  availableRooms,
  canCreateBooking,
  onSearch,
  onClear,
  onRetry,
  onReserve,
}: RoomAvailabilityPanelProps) => {
  const nights =
    dates && dates.to > dates.from
      ? differenceInCalendarDays(parseISO(dates.to), parseISO(dates.from))
      : 0;

  return (
    <div className="space-y-4">
      <AvailabilityPicker onSearch={onSearch} onClear={onClear} />

      {dates ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">
              Disponibilidad del {dates.from} al {dates.to}
            </p>
            <p className="mt-1 text-xs font-medium text-primary/80">
              {error ? (
                "No se pudo cargar la disponibilidad."
              ) : isLoading ? (
                "Buscando habitaciones disponibles..."
              ) : (
                `${availableRooms.length} habitaciones encontradas · ${nights} ${nights === 1 ? "noche" : "noches"}`
              )}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full border-primary/20 bg-background/90 sm:w-auto"
            onClick={onClear}
          >
            Limpiar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          <CalendarSearch className="h-5 w-5 shrink-0" />
          Elegí un rango de fechas y presioná Buscar para ver habitaciones disponibles.
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-destructive">No se pudo cargar la disponibilidad</p>
            <p className="mt-1 text-sm text-destructive/80">{error}</p>
          </div>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((card) => (
            <div key={card} className="h-32 rounded-2xl border border-border bg-muted animate-pulse" />
          ))}
        </div>
      ) : null}

      {!isLoading && !error && dates && availableRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-14 text-center">
          <h3 className="text-lg font-bold text-foreground">
            No hay habitaciones disponibles para este rango
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Probá con otras fechas o revisá el Planificador para ver la ocupación de la semana.
          </p>
          <Button variant="outline" className="mt-4 h-10 rounded-xl" onClick={onClear}>
            Cambiar fechas
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && availableRooms.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {availableRooms.map((room) => (
            <div
              key={room.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-foreground">
                    Habitación {room.room_number}
                  </p>
                  <p className="text-sm text-muted-foreground">{room.room_type}</p>
                </div>
                {getRoomStatusBadge(room.status)}
              </div>
              <p className="font-mono font-bold text-foreground">
                ${(room.price_cents / 100).toLocaleString("es-AR")}
              </p>
              {canCreateBooking ? (
                <Button className="h-10 rounded-xl" onClick={() => onReserve(room)}>
                  Reservar
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
