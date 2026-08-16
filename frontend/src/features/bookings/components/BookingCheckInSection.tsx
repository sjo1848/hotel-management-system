import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  roomLabel?: string;
};

export const BookingCheckInSection = ({
  form,
  checkInBlockers,
  canCompleteFormalCheckIn,
  statusLoading,
  onFormChange,
  onStatusAction,
  roomLabel,
}: BookingCheckInSectionProps) => {
  const [mobileStep, setMobileStep] = useState(0);
  const mobileSteps = ["Verificación", "Datos / estadía", "Habitación", "Confirmar ingreso"];
  const canAdvanceMobile = mobileStep === 0
    ? form.documentVerified && form.stayConfirmed && form.contactConfirmed
    : mobileStep === 1
      ? Number(form.guestsCount) > 0
      : true;

  return (
  <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
    <div className="md:hidden">
      <PanelHeader icon={CheckCircle2} title="Check-in" description="Completá un paso por vez para registrar el ingreso." />
      <div className="mb-4 flex items-center gap-1" aria-label="Progreso del check-in">
        {mobileSteps.map((step, index) => (
          <div key={step} className="flex min-w-0 flex-1 items-center gap-1">
            <span
              aria-current={mobileStep === index ? "step" : undefined}
              className={cn(
                "h-2 w-full rounded-full",
                index <= mobileStep ? "bg-primary" : "bg-primary/20",
              )}
            />
            {index === mobileStep ? <span className="sr-only">{step}</span> : null}
          </div>
        ))}
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Paso {mobileStep + 1} de {mobileSteps.length}: {mobileSteps[mobileStep]}
      </p>

      {mobileStep === 0 ? (
        <div className="space-y-3">
          {[
            ["documentVerified", "Identidad validada", "Documento revisado o identidad confirmada por recepción."],
            ["stayConfirmed", "Fechas y tarifa confirmadas", "El huésped aceptó entrada, salida y condiciones vigentes."],
            ["contactConfirmed", "Contacto verificado", "Se confirmó un canal de contacto válido."],
          ].map(([field, title, description]) => (
            <label key={field} className="flex min-h-11 items-start gap-3 rounded-2xl border border-primary/20 bg-card px-4 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 rounded border-border text-primary"
                checked={form[field as keyof BookingCheckInFormState] as boolean}
                onChange={(event) => onFormChange({ [field]: event.target.checked })}
              />
              <span><span className="block font-semibold text-foreground">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
            </label>
          ))}
        </div>
      ) : null}
      {mobileStep === 1 ? (
        <div className="space-y-4 rounded-2xl border border-primary/20 bg-card p-4">
          <div className="grid gap-2"><Label htmlFor="mobile-checkin-guests-count">Huéspedes finales</Label><Input id="mobile-checkin-guests-count" type="number" min="1" value={form.guestsCount} onChange={(event) => onFormChange({ guestsCount: event.target.value })} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label htmlFor="mobile-checkin-arrival-reference">Referencia interna <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="mobile-checkin-arrival-reference" value={form.arrivalReference} onChange={(event) => onFormChange({ arrivalReference: event.target.value })} placeholder="Ej: late arrival" className="h-11 rounded-xl" /></div>
        </div>
      ) : null}
      {mobileStep === 2 ? (
        <div className="rounded-2xl border border-primary/20 bg-card p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Habitación asignada</p><p className="mt-2 text-lg font-bold text-foreground">{roomLabel ?? "Habitación confirmada"}</p><p className="mt-1 text-sm text-muted-foreground">Verificá que la habitación esté lista antes de confirmar el ingreso.</p></div>
      ) : null}
      {mobileStep === 3 ? (
        <div className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"><p className="font-semibold">Todo listo para ingresar</p><p className="text-sm text-muted-foreground">{roomLabel ?? "La habitación asignada"} · {form.guestsCount} huésped(es).</p>{checkInBlockers.length > 0 ? <BlockerList blockers={checkInBlockers} /> : <p className="text-sm text-primary">La verificación está completa. Confirmá el ingreso.</p>}</div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={() => setMobileStep((step) => Math.max(0, step - 1))} disabled={mobileStep === 0}><ChevronLeft className="h-4 w-4" />Atrás</Button>
        {mobileStep < mobileSteps.length - 1 ? <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={() => setMobileStep((step) => step + 1)} disabled={!canAdvanceMobile}>Siguiente<ChevronRight className="h-4 w-4" /></Button> : <Button type="button" className="min-h-11 flex-1 rounded-xl bg-primary hover:bg-primary/90" onClick={() => onStatusAction("CheckedIn")} disabled={statusLoading !== null || !canCompleteFormalCheckIn}><CheckCircle2 className="h-4 w-4" />{statusLoading === "CheckedIn" ? "Registrando…" : "Confirmar ingreso"}</Button>}
      </div>
    </div>
    <div className="hidden md:block">
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
  </div>
  );
};
