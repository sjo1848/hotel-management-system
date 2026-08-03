import { DoorOpen, Loader2, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booking, Room } from "@/types/domain";
import { BlockerList, PanelHeader } from "@/features/bookings/components/BookingSectionShared";
import { cn } from "@/lib/utils";

type BookingReassignmentSectionProps = {
  booking: Booking;
  roomOptionsLoading: boolean;
  roomOptions: Room[];
  selectedRoomId: string;
  reassignmentReason: string;
  reassignmentBlockers: string[];
  reassignmentLoading: boolean;
  onSelectRoom: (roomId: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
};

export const BookingReassignmentSection = ({
  booking,
  roomOptionsLoading,
  roomOptions,
  selectedRoomId,
  reassignmentReason,
  reassignmentBlockers,
  reassignmentLoading,
  onSelectRoom,
  onReasonChange,
  onSubmit,
}: BookingReassignmentSectionProps) => (
  <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
    <PanelHeader
      icon={DoorOpen}
      title="Reasignacion / excepcion admin"
      description="Mueve la reserva a otra habitacion disponible sin salir del centro operativo."
    />

    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Regla operativa
          </p>
          <p className="mt-2 text-sm text-foreground">
            {booking.status === "CheckedIn"
              ? "La habitacion actual pasara a Dirty y la nueva quedara Occupied."
              : "La reasignacion actualiza la reserva, sin ocupar todavia la nueva habitacion."}
          </p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <Label htmlFor="reassign-room">Nueva habitacion</Label>
          {roomOptionsLoading ? (
            <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando alternativas disponibles...
            </div>
          ) : roomOptions.length > 0 ? (
            <div className="grid gap-2">
              {roomOptions.slice(0, 4).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onSelectRoom(candidate.id)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    selectedRoomId === candidate.id
                      ? "border-primary/20 bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/20 hover:bg-primary/10",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {candidate.room_number} · {candidate.room_type}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        ${(candidate.price_cents / 100).toLocaleString("es-AR")} por noche
                      </p>
                    </div>
                    <Badge variant="outline">{candidate.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay habitaciones disponibles para estas fechas.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <Label htmlFor="reassignment-reason">Motivo operativo</Label>
          <Input
            id="reassignment-reason"
            value={reassignmentReason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ej: room issue, upgrade, mantenimiento, overbooking"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Se registra en auditoria junto con el cambio de habitacion.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Estado del movimiento
            </p>
            <Badge variant={reassignmentBlockers.length === 0 ? "success" : "warning"}>
              {reassignmentBlockers.length === 0 ? "Listo" : "Pendiente"}
            </Badge>
          </div>

          {reassignmentBlockers.length > 0 ? (
            <BlockerList blockers={reassignmentBlockers} />
          ) : (
            <p className="mt-3 text-sm text-primary">
              La reserva puede moverse de habitacion sin salir de esta ficha.
            </p>
          )}

          <Button
            className="mt-4 h-11 w-full rounded-2xl bg-primary hover:bg-primary/90"
            onClick={onSubmit}
            disabled={reassignmentLoading || reassignmentBlockers.length > 0}
          >
            {reassignmentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PencilLine className="h-4 w-4" />
            )}
            Cambiar habitacion
          </Button>
        </div>
      </div>
    </div>
  </div>
);
