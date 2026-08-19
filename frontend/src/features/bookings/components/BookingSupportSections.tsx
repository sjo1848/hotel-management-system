import { useEffect, useState } from "react";
import {
  CreditCard,
  DoorOpen,
  Loader2,
  PencilLine,
  Plus,
  Receipt,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Booking,
  BookingFrontDeskData,
  BookingStatus,
  ExtraCharge,
  Invoice,
  PaymentEntry,
  PaymentMethod,
  Room,
} from "@/types/domain";
import { PanelHeader } from "@/features/bookings/components/BookingSectionShared";
import BookingArrivalExceptionActions from "@/features/bookings/components/BookingArrivalExceptionActions";
import { useMediaQuery } from "@/lib/useMediaQuery";

type BookingSidebarPanelsProps = {
  booking: Booking;
  room: Room | null;
  loading: boolean;
  invoice: Invoice | null;
  statusLoading: BookingStatus | null;
  onEditBooking?: () => void;
  onStatusAction: (status: BookingStatus, data?: Partial<BookingFrontDeskData>) => void;
};

type BookingAccountSectionProps = {
  booking: Booking;
  accommodationTotal: number;
  extrasTotal: number;
  loadingCharges: boolean;
  quickCharges: Array<{ label: string; category: string; amount_cents: number }>;
  onQuickCharge: (label: string, amountCents: number, category: string) => void;
  outstandingAmountCents: number;
  paymentMethod: PaymentMethod;
  paymentAmount: string;
  paymentReference: string;
  paymentNote: string;
  settlementLoading: boolean;
  invoice: Invoice | null;
  payments: PaymentEntry[];
  extraCharges: ExtraCharge[];
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentReferenceChange: (value: string) => void;
  onPaymentNoteChange: (value: string) => void;
  onRegisterPayment: () => void;
};

export const BookingSidebarPanels = ({
  booking,
  room,
  loading,
  invoice,
  statusLoading,
  onEditBooking,
  onStatusAction,
}: BookingSidebarPanelsProps) => (
  <>
    <div className="rounded-3xl border border-border bg-background/70 p-5">
      <PanelHeader
        icon={Sparkles}
        title="Acciones"
        description="Operacion diaria de la reserva."
      />

      <div className="grid gap-2">
        {booking.status === "Confirmed" ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            <p className="font-semibold">Check-in formal requerido</p>
            <p className="mt-1 text-xs">
              Completa el checklist operativo del panel izquierdo antes de registrar el ingreso.
            </p>
          </div>
        ) : null}

        {booking.status === "CheckedIn" ? (
          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
            <p className="font-semibold">Checkout formal requerido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completa el checklist del panel izquierdo antes de registrar la salida.
            </p>
          </div>
        ) : null}

        {booking.status === "Confirmed" ? (
          <BookingArrivalExceptionActions
            booking={booking}
            statusLoading={statusLoading}
            onAction={onStatusAction}
          />
        ) : null}

        <Button variant="outline" className="h-11 justify-start rounded-2xl" onClick={onEditBooking}>
          <PencilLine className="h-4 w-4" />
          Editar reserva
        </Button>
      </div>
    </div>

    <div className="rounded-3xl border border-border bg-background/70 p-5">
      <PanelHeader
        icon={DoorOpen}
        title="Habitacion"
        description="Estado operativo al momento."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando estado de habitacion
        </div>
      ) : room ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Numero
            </p>
            <p className="mt-2 text-lg font-black text-foreground">{room.room_number}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Tipo y estado
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{room.room_type}</p>
            <Badge variant="outline" className="mt-3">
              {room.status}
            </Badge>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Tarifa base
            </p>
            <p className="mt-2 text-lg font-black text-foreground">
              ${(room.price_cents / 100).toLocaleString("es-AR")}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No se pudo cargar la habitacion.</p>
      )}
    </div>

    <div className="rounded-3xl border border-border bg-background/70 p-5">
      <PanelHeader
        icon={Receipt}
        title="Facturacion"
        description="Estado final de cobro."
      />

      {invoice ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Estado
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{invoice.status}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Monto
            </p>
            <p className="mt-2 text-lg font-black text-foreground">
              ${(invoice.amount_cents / 100).toLocaleString("es-AR")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Cobrado / saldo
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              ${(invoice.paid_amount_cents / 100).toLocaleString("es-AR")} cobrados
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ${(Math.max(0, invoice.amount_cents - invoice.paid_amount_cents) / 100).toLocaleString("es-AR")} pendientes
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Ultimo medio de pago
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{invoice.payment_method}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Emitida
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Cobrada
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {invoice.paid_at ? format(new Date(invoice.paid_at), "dd/MM/yyyy HH:mm") : "Pendiente"}
            </p>
            {invoice.payment_reference ? (
              <p className="mt-1 text-xs text-muted-foreground">{invoice.payment_reference}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavia no existe factura asociada para esta reserva.
        </p>
      )}
    </div>
  </>
);

export const BookingAccountSection = ({
  booking,
  accommodationTotal,
  extrasTotal,
  loadingCharges,
  quickCharges,
  onQuickCharge,
  outstandingAmountCents,
  paymentMethod,
  paymentAmount,
  paymentReference,
  paymentNote,
  settlementLoading,
  invoice,
  payments,
  extraCharges,
  onPaymentMethodChange,
  onPaymentAmountChange,
  onPaymentReferenceChange,
  onPaymentNoteChange,
  onRegisterPayment,
}: BookingAccountSectionProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(isDesktop);
  const [movementsOpen, setMovementsOpen] = useState(isDesktop);

  useEffect(() => {
    if (isDesktop) {
      setPaymentHistoryOpen(true);
      setMovementsOpen(true);
    }
  }, [isDesktop]);

  return (
  <div className="rounded-3xl border border-border bg-background/70 p-3 sm:p-5">
    <PanelHeader
      icon={CreditCard}
      title="Cuenta y cargos"
      description="Saldo actual y próxima acción de cobro."
    />

    <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Alojamiento
        </p>
        <p className="mt-1 text-lg font-black text-foreground sm:mt-2 sm:text-xl">
          ${(accommodationTotal / 100).toLocaleString("es-AR")}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Extras
        </p>
        <p className="mt-1 text-lg font-black text-foreground sm:mt-2 sm:text-xl">
          ${(extrasTotal / 100).toLocaleString("es-AR")}
        </p>
      </div>
      <div className="col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 shadow-sm sm:col-span-1 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Total
        </p>
        <p className="mt-1 text-lg font-black text-foreground sm:mt-2 sm:text-xl">
          ${(booking.total_price_cents / 100).toLocaleString("es-AR")}
        </p>
      </div>
    </div>

    <div className="mt-4 sm:mt-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Cargos rapidos
        </p>
        {loadingCharges ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {quickCharges.map((charge) => (
          <Button
            key={charge.label}
            variant="outline"
            className="justify-start rounded-2xl border-border bg-card px-4 py-3 text-left"
            onClick={() => onQuickCharge(charge.label, charge.amount_cents, charge.category)}
            disabled={booking.status === "Cancelled" || booking.status === "NoShow" || booking.status === "CheckedOut"}
          >
            <Plus className="h-4 w-4" />
            <span className="flex flex-col items-start">
              <span className="font-semibold">{charge.label}</span>
              <span className="text-xs text-muted-foreground">
                ${(charge.amount_cents / 100).toLocaleString("es-AR")}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>

    {booking.status === "CheckedIn" || booking.status === "CheckedOut" ? (
      <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Cobros y saldo
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {outstandingAmountCents === 0 ? "Cuenta cobrada" : "Saldo pendiente"}
            </p>
          </div>
          <Badge variant={outstandingAmountCents === 0 ? "success" : "warning"}>
            {outstandingAmountCents === 0 ? "PAID" : "PENDING"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
          {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((method) => (
            <Button
              key={method}
              type="button"
              variant={paymentMethod === method ? "default" : "outline"}
              className="justify-start rounded-xl"
              disabled={outstandingAmountCents === 0}
              onClick={() => onPaymentMethodChange(method)}
            >
              <CreditCard className="h-4 w-4" />
              {method}
            </Button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Monto a registrar</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(event) => onPaymentAmountChange(event.target.value)}
              placeholder="Ej: 25000"
              className="h-10 rounded-xl"
              disabled={outstandingAmountCents === 0}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-reference">Referencia de pago</Label>
            <Input
              id="payment-reference"
              value={paymentReference}
              onChange={(event) => onPaymentReferenceChange(event.target.value)}
              placeholder="Ej: pos 9841, transferencia 2874, caja turno noche"
              className="h-10 rounded-xl"
              disabled={outstandingAmountCents === 0}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <Label htmlFor="payment-note">Nota operativa</Label>
          <Input
            id="payment-note"
            value={paymentNote}
            onChange={(event) => onPaymentNoteChange(event.target.value)}
            placeholder="Ej: anticipo recepcion, saldo por POS, transferencia validada"
            className="h-10 rounded-xl"
            disabled={outstandingAmountCents === 0}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
            <p className="text-xl font-black text-foreground">
              ${(outstandingAmountCents / 100).toLocaleString("es-AR")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cobrado ${((invoice?.paid_amount_cents ?? 0) / 100).toLocaleString("es-AR")}
            </p>
          </div>
          <Button
            type="button"
            className="rounded-xl"
            disabled={settlementLoading || outstandingAmountCents === 0}
            onClick={onRegisterPayment}
          >
            {settlementLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            Registrar cobro
          </Button>
        </div>

        <details open={isDesktop || paymentHistoryOpen} onToggle={(event) => { if (!isDesktop) setPaymentHistoryOpen(event.currentTarget.open); }} className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-3">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
            Historial de cobros
          </summary>
          <div className="mt-3 space-y-2 sm:mt-0 sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Timeline de cobros
          </p>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavia no hay cobros registrados para esta reserva.
            </p>
          ) : (
            payments.slice(0, 6).map((payment) => (
              <div
                key={payment.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {payment.payment_method} · ${(payment.amount_cents / 100).toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(payment.received_at), "dd/MM/yyyy HH:mm")}
                  </p>
                  {payment.payment_reference ? (
                    <p className="text-xs text-muted-foreground">{payment.payment_reference}</p>
                  ) : null}
                  {payment.note ? (
                    <p className="text-xs text-muted-foreground">{payment.note}</p>
                  ) : null}
                </div>
                <Badge variant="outline">{payment.payment_method}</Badge>
              </div>
            ))
          )}
          </div>
        </details>
      </div>
    ) : null}

    {booking.status === "CheckedIn" ? (
      <div className="mt-5 rounded-2xl border border-border bg-muted/50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Cierre operativo
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Saldo de referencia para checkout
            </p>
          </div>
          <p className="text-xl font-black text-foreground">
            ${(outstandingAmountCents / 100).toLocaleString("es-AR")}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          El checkout contable valida el saldo pendiente real de la reserva segun los cobros registrados.
        </p>
      </div>
    ) : null}

    <details open={isDesktop || movementsOpen} onToggle={(event) => { if (!isDesktop) setMovementsOpen(event.currentTarget.open); }} className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-sm sm:mt-5 sm:p-4">
      <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground md:hidden">
        Últimos movimientos
      </summary>
      <div className="mt-3 space-y-2 sm:mt-0 sm:block">
      {extraCharges.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin cargos extra registrados por el momento.
        </p>
      ) : (
        extraCharges.slice(0, 5).map((charge) => (
          <div
            key={charge.id}
            className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{charge.description}</p>
              <p className="text-xs text-muted-foreground">{charge.category}</p>
            </div>
            <p className="text-sm font-bold text-foreground">
              ${(charge.amount_cents / 100).toLocaleString("es-AR")}
            </p>
          </div>
        ))
      )}
      </div>
    </details>
  </div>
  );
};
