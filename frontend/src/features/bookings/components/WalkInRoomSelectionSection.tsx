import { BedDouble, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WalkInRoomSelectionSectionProps } from "@/features/bookings/components/WalkInShared";
import { MobilePickerSurface } from "@/features/bookings/components/MobilePickerSurface";

export const WalkInRoomSelectionSection = ({
  nights,
  roomsLoading,
  roomsError,
  rooms,
  selectedRoomId,
  onSelectRoom,
  roomPickerOpen,
  onRoomPickerOpenChange,
}: WalkInRoomSelectionSectionProps) => {
  const [roomSearch, setRoomSearch] = useState("");
  const roomPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const roomSearchRef = useRef<HTMLInputElement>(null);
  const desktopRoomHeadingRef = useRef<HTMLParagraphElement>(null);
  const pickerWasOpen = useRef(false);
  const filteredRooms = useMemo(() => {
    const term = roomSearch.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) =>
      `${room.room_number} ${room.room_type}`.toLowerCase().includes(term),
    );
  }, [roomSearch, rooms]);

  useEffect(() => {
    if (!roomPickerOpen && pickerWasOpen.current) {
      roomPickerTriggerRef.current?.focus();
    }
    pickerWasOpen.current = roomPickerOpen;
  }, [roomPickerOpen]);

  return (
  <div className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <BedDouble className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <p ref={desktopRoomHeadingRef} tabIndex={-1} className="text-sm font-black text-foreground">Habitacion disponible</p>
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
          <>
          <div className="md:hidden">
            <Button ref={roomPickerTriggerRef} type="button" variant="outline" className="h-auto w-full justify-between rounded-2xl px-4 py-3 text-left" onClick={() => onRoomPickerOpenChange(true)}>
              <span>
                <span className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Habitación disponible</span>
                <span className="mt-1 block text-sm font-semibold text-foreground">
                  {selectedRoomId
                    ? `Habitacion ${rooms.find((room) => room.id === selectedRoomId)?.room_number ?? "seleccionada"}`
                    : `Habitacion ${rooms[0]?.room_number ?? "disponible"}`}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedRoomId ? "Asignada · tocar para cambiar" : `Sugerida · Total estimado $${((rooms[0]?.price_cents ?? 0) * nights / 100).toLocaleString("es-AR")}`}
                </span>
              </span>
              <BedDouble className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </div>
          <div className="hidden gap-3 md:grid md:grid-cols-2">
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
          <MobilePickerSurface
            open={roomPickerOpen}
            title="Seleccionar habitación"
            description="Elegí una habitación disponible para estas fechas."
            titleId="mobile-room-picker-title"
            initialFocusRef={roomSearchRef}
            desktopFocusRef={desktopRoomHeadingRef}
            onClose={() => onRoomPickerOpenChange(false)}
          >
              <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                <label htmlFor="mobile-room-search" className="sr-only">Buscar habitación</label>
                <div className="relative mb-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input ref={roomSearchRef} id="mobile-room-search" value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder="Buscar por número o tipo" className="h-12 rounded-xl pl-9" />
                </div>
                <div className="space-y-2">
                {filteredRooms.length === 0 ? <div className="rounded-2xl border border-border px-4 py-4 text-sm text-muted-foreground">No hay habitaciones que coincidan.</div> : filteredRooms.map((room) => {
                  const selected = selectedRoomId === room.id;
                  return (
                    <button key={room.id} type="button" className={cn("w-full rounded-2xl border px-4 py-4 text-left", selected ? "border-primary/20 bg-primary/10" : "border-border bg-background")} onClick={() => { onSelectRoom(room.id); onRoomPickerOpenChange(false); }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-foreground">Habitación {room.room_number}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{room.room_type}</p>
                        </div>
                        <p className="text-sm font-bold text-foreground">${(room.price_cents / 100).toLocaleString("es-AR")} / noche</p>
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
          </MobilePickerSurface>
          </>
        )}
      </div>
    </div>
  </div>
  );
};
