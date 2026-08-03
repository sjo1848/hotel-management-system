import { BedDouble, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalkInRoomSelectionSectionProps } from "@/features/bookings/components/WalkInShared";

export const WalkInRoomSelectionSection = ({
  nights,
  roomsLoading,
  roomsError,
  rooms,
  selectedRoomId,
  onSelectRoom,
}: WalkInRoomSelectionSectionProps) => (
  <div className="rounded-3xl border border-border bg-background/70 p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <BedDouble className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <p className="text-sm font-black text-foreground">Habitacion disponible</p>
          <p className="text-sm text-muted-foreground">
            La lista se recalcula en cuanto cambian las fechas de estadia.
          </p>
        </div>

        {roomsLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando disponibilidad...
          </div>
        ) : roomsError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {roomsError}
          </div>
        ) : nights <= 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            Ajusta las fechas para consultar habitaciones vendibles.
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-800">
            No hay habitaciones disponibles para ese rango.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rooms.map((room) => {
              const estimatedTotal = room.price_cents * nights;
              const selected = selectedRoomId === room.id;

              return (
                <button
                  key={room.id}
                  type="button"
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition-all",
                    selected
                      ? "border-primary/20 bg-primary/10 shadow-sm"
                      : "border-border bg-card hover:border-primary/20 hover:bg-primary/10",
                  )}
                  onClick={() => onSelectRoom(room.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">Habitacion {room.room_number}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {room.room_type}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                        selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
                      {selected ? "Asignada" : "Disponible"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Tarifa por noche</p>
                      <p className="text-sm font-semibold text-foreground">
                        ${(room.price_cents / 100).toLocaleString("es-AR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total estimado</p>
                      <p className="text-base font-black text-foreground">
                        ${(estimatedTotal / 100).toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
);
