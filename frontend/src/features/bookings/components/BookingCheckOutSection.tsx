import { Loader2, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingStatus } from "@/types/domain";
import {
  BlockerList,
  BookingCheckOutFormState,
  PanelHeader,
} from "@/features/bookings/components/BookingSectionShared";

type BookingCheckOutSectionProps = {
  form: BookingCheckOutFormState;
  checkoutBlockers: string[];
  canCompleteFormalCheckOut: boolean;
  statusLoading: BookingStatus | null;
  outstandingAmountCents: number;
  canOverrideCheckoutBalance: boolean;
  onFormChange: (patch: Partial<BookingCheckOutFormState>) => void;
  onStatusAction: (status: BookingStatus) => void;
};

export const BookingCheckOutSection = ({
  form,
  checkoutBlockers,
  canCompleteFormalCheckOut,
  statusLoading,
  outstandingAmountCents,
  canOverrideCheckoutBalance,
  onFormChange,
  onStatusAction,
}: BookingCheckOutSectionProps) => (
  <div className="rounded-3xl border border-border bg-muted/50 p-5">
    <PanelHeader
      icon={LogOut}
      title="Checkout formal"
      description="Recepcion debe cerrar cuenta, liberar la habitacion y definir la politica de saldo antes de finalizar la estadia."
      tone="muted"
    />

    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.chargesReviewed}
            onChange={(event) => onFormChange({ chargesReviewed: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Cuenta revisada</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Recepcion confirmo alojamiento, extras y total final de la estadia.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.roomReleaseConfirmed}
            onChange={(event) => onFormChange({ roomReleaseConfirmed: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Habitacion liberada</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              El huesped ya desocupo la habitacion y recepcion puede cerrar la estancia.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-border text-primary"
            checked={form.housekeepingHandoff}
            onChange={(event) => onFormChange({ housekeepingHandoff: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-foreground">Handoff a housekeeping</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              La salida ya fue comunicada para que la habitacion pase a limpieza.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Label className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Politica de saldo
          </Label>
          <div className="mt-3 grid gap-2">
            <Button
              type="button"
              variant={form.paymentPolicy === "settled" ? "default" : "outline"}
              className="justify-start rounded-xl"
              onClick={() => onFormChange({ paymentPolicy: "settled" })}
            >
              Cuenta cobrada al cierre
            </Button>
            {canOverrideCheckoutBalance ? (
              <Button
                type="button"
                variant={form.paymentPolicy === "pending-approved" ? "default" : "outline"}
                className="justify-start rounded-xl"
                onClick={() => onFormChange({ paymentPolicy: "pending-approved" })}
              >
                Saldo pendiente autorizado
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {canOverrideCheckoutBalance
              ? "El override deja actor, saldo y referencia en auditoria."
              : "Los saldos pendientes requieren autorizacion administrativa."}
          </p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Label htmlFor="checkout-reference">Referencia de cierre</Label>
          <Input
            id="checkout-reference"
            value={form.closingReference}
            onChange={(event) => onFormChange({ closingReference: event.target.value })}
            placeholder="Ej: pago tarjeta, saldo empresa, checkout express"
            className="h-10 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Obligatoria si se deja saldo pendiente; se persiste en la reserva y auditoria.
          </p>
        </div>
      </div>
    </div>

    <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Estado del checkout
        </p>
        <Badge variant={canCompleteFormalCheckOut ? "success" : "warning"}>
          {canCompleteFormalCheckOut ? "Listo para cerrar" : "Pendiente"}
        </Badge>
      </div>

      {form.paymentPolicy === "pending-approved" ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Checkout por excepcion: la estancia va a cerrarse con saldo pendiente autorizado.
        </div>
      ) : null}

      {checkoutBlockers.length > 0 ? (
        <BlockerList blockers={checkoutBlockers} />
      ) : (
        <p className="mt-3 text-sm text-primary">
          Todo listo. Recepcion ya puede cerrar la estadia y pasar la habitacion a limpieza.
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Saldo pendiente validado</p>
          <p className="text-sm font-semibold text-foreground">
            ${(outstandingAmountCents / 100).toLocaleString("es-AR")}
          </p>
        </div>
        <Button
          className="h-11 rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/85"
          onClick={() => onStatusAction("CheckedOut")}
          disabled={statusLoading !== null || !canCompleteFormalCheckOut}
        >
          {statusLoading === "CheckedOut" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Confirmar salida y enviar a limpieza
        </Button>
      </div>
    </div>
  </div>
);
