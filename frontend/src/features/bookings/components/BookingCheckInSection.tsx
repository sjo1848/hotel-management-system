import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingStatus } from "@/types/domain";
import {
  BlockerList,
  BookingCheckInFormState,
  PanelHeader,
} from "@/features/bookings/components/BookingSectionShared";

type BookingCheckInSectionProps = {
  form: BookingCheckInFormState;
  checkInBlockers: string[];
  canCompleteFormalCheckIn: boolean;
  statusLoading: BookingStatus | null;
  onFormChange: (patch: Partial<BookingCheckInFormState>) => void;
  onStatusAction: (status: BookingStatus) => void;
};

export const BookingCheckInSection = ({
  form,
  checkInBlockers,
  canCompleteFormalCheckIn,
  statusLoading,
  onFormChange,
  onStatusAction,
}: BookingCheckInSectionProps) => (
  <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
    <PanelHeader
      icon={CheckCircle2}
      title="Check-in formal"
      description="Recepcion debe completar este checklist antes de ocupar la habitacion."
    />

    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.documentVerified}
            onChange={(event) => onFormChange({ documentVerified: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Identidad validada</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Documento revisado o identidad confirmada por recepcion.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.stayConfirmed}
            onChange={(event) => onFormChange({ stayConfirmed: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Fechas y tarifa confirmadas</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              El huesped acepto entrada, salida y condiciones vigentes de la estadia.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.contactConfirmed}
            onChange={(event) => onFormChange({ contactConfirmed: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Contacto verificado</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Se confirmo un canal de contacto valido para incidencias o cobro.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <Label htmlFor="checkin-guests-count">Huespedes finales</Label>
          <Input
            id="checkin-guests-count"
            type="number"
            min="1"
            value={form.guestsCount}
            onChange={(event) => onFormChange({ guestsCount: event.target.value })}
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Cantidad final confirmada al momento del ingreso.
          </p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <Label htmlFor="checkin-arrival-reference">Referencia interna</Label>
          <Input
            id="checkin-arrival-reference"
            value={form.arrivalReference}
            onChange={(event) => onFormChange({ arrivalReference: event.target.value })}
            placeholder="Ej: ingreso con equipaje, VIP, late arrival"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Campo operativo local. Todavia no persiste en backend.
          </p>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Estado del checklist
        </p>
        <Badge variant={canCompleteFormalCheckIn ? "success" : "warning"}>
          {canCompleteFormalCheckIn ? "Listo para ingresar" : "Pendiente"}
        </Badge>
      </div>

      {checkInBlockers.length > 0 ? (
        <BlockerList blockers={checkInBlockers} />
      ) : (
        <p className="mt-3 text-sm text-primary">
          Todo listo. Recepcion ya puede registrar el ingreso formal del huesped.
        </p>
      )}

      <Button
        className="mt-4 h-11 w-full rounded-2xl bg-primary hover:bg-primary/90"
        onClick={() => onStatusAction("CheckedIn")}
        disabled={statusLoading !== null || !canCompleteFormalCheckIn}
      >
        {statusLoading === "CheckedIn" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Confirmar ingreso y ocupar habitacion
      </Button>
    </div>
  </div>
);
