import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";
import { WalkInSidebarPanelsProps } from "@/features/bookings/components/WalkInShared";

export const WalkInSidebarPanels = ({
  guestMode,
  selectedGuest,
  newGuestName,
  selectedRoom,
  nights,
  checkIn,
  checkOut,
}: WalkInSidebarPanelsProps) => (
  <>
    <SectionCard as="div">
      <SectionEyebrow>Checklist recepcion</SectionEyebrow>
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
          <SectionEyebrow>1. Estadia</SectionEyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {nights > 0 ? "Rango valido" : "Falta corregir fechas"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
          <SectionEyebrow>2. Huesped</SectionEyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {guestMode === "existing"
              ? selectedGuest?.full_name ?? "Seleccion pendiente"
              : newGuestName.trim() || "Alta rapida pendiente"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
          <SectionEyebrow>3. Habitacion</SectionEyebrow>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {selectedRoom ? `Room ${selectedRoom.room_number}` : "Asignacion pendiente"}
          </p>
        </div>
      </div>
    </SectionCard>

    <SectionCard as="div">
      <SectionEyebrow>Resumen operativo</SectionEyebrow>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Huesped</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {guestMode === "existing"
              ? selectedGuest?.full_name ?? "Sin seleccionar"
              : newGuestName.trim() || "Sin registrar"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Estadia</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {nights > 0 ? `${nights} ${nights === 1 ? "noche" : "noches"}` : "Pendiente"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {checkIn} {"->"} {checkOut}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Habitacion</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {selectedRoom ? `${selectedRoom.room_number} · ${selectedRoom.room_type}` : "Pendiente"}
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-4">
          <p className="text-xs text-muted-foreground">Revenue estimado</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
            $
            {selectedRoom && nights > 0
              ? ((selectedRoom.price_cents * nights) / 100).toLocaleString("es-AR")
              : "0"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo alojamiento. Extras y politicas de cobro quedan para check-in / checkout.
          </p>
        </div>
      </div>
    </SectionCard>
  </>
);
