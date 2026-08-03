import { DoorOpen, Loader2, LogOut, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { Booking, BookingStatus, Room } from "@/types/domain";
import { NextAction, PanelHeader } from "@/features/bookings/components/BookingSectionShared";

type BookingSummaryMetricsProps = {
  booking: Booking;
  room: Room | null;
  nights: number;
};

type BookingNextActionBannerProps = {
  nextAction: NextAction;
  statusLoading: BookingStatus | null;
  onStatusAction: (status: BookingStatus) => void;
};

type BookingGuestStaySectionProps = {
  booking: Booking;
  room: Room | null;
};

export const BookingSummaryMetrics = ({
  booking,
  room,
  nights,
}: BookingSummaryMetricsProps) => (
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Huesped
      </p>
      <p className="mt-3 text-lg font-black text-foreground">{booking.guest_name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {booking.guest_id ? "Huesped registrado" : "Sin ficha vinculada"}
      </p>
    </div>
    <div className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Habitacion
      </p>
      <p className="mt-3 text-lg font-black text-foreground">
        {room ? room.room_number : booking.room_id.slice(0, 6)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {room ? `${room.room_type} · ${room.status}` : "Cargando detalle operativo"}
      </p>
    </div>
    <div className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Estadia
      </p>
      <p className="mt-3 text-lg font-black text-foreground">{nights} noches</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {format(parseISO(booking.check_in), "dd MMM", { locale: es })} al{" "}
        {format(parseISO(booking.check_out), "dd MMM", { locale: es })}
      </p>
    </div>
    <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        Total actual
      </p>
      <p className="mt-3 text-2xl font-black text-foreground">
        ${(booking.total_price_cents / 100).toLocaleString("es-AR")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">alojamiento + cargos</p>
    </div>
  </section>
);

export const BookingNextActionBanner = ({
  nextAction,
  statusLoading,
  onStatusAction,
}: BookingNextActionBannerProps) => (
  <section className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Siguiente movimiento recomendado
        </p>
        <h3 className="text-lg font-black tracking-tight text-foreground">{nextAction.title}</h3>
        <p className="max-w-[64ch] text-sm text-muted-foreground">{nextAction.description}</p>
      </div>

      {nextAction.action === "check-in" ? (
        <Button
          className="h-11 w-full rounded-2xl lg:w-auto"
          disabled={nextAction.disabled || statusLoading === "CheckedIn"}
          onClick={() => onStatusAction("CheckedIn")}
        >
          {statusLoading === "CheckedIn" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DoorOpen className="h-4 w-4" />
          )}
          {nextAction.buttonLabel}
        </Button>
      ) : null}

      {nextAction.action === "check-out" ? (
        <Button
          className="h-11 w-full rounded-2xl lg:w-auto"
          disabled={nextAction.disabled || statusLoading === "CheckedOut"}
          onClick={() => onStatusAction("CheckedOut")}
        >
          {statusLoading === "CheckedOut" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {nextAction.buttonLabel}
        </Button>
      ) : null}
    </div>
  </section>
);

export const BookingGuestStaySection = ({
  booking,
  room,
}: BookingGuestStaySectionProps) => (
  <div className="rounded-3xl border border-border bg-background/70 p-5">
    <PanelHeader
      icon={User}
      title="Huesped y estadia"
      description="Informacion operativa para recepcion."
    />

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Check-in
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {format(parseISO(booking.check_in), "EEEE dd MMM yyyy", { locale: es })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Ingreso operativo desde las 15:00</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Check-out
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {format(parseISO(booking.check_out), "EEEE dd MMM yyyy", { locale: es })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Salida operativa hasta las 11:00</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Habitacion actual
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {room ? `${room.room_number} · ${room.room_type}` : booking.room_id}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Estado operativo: {room?.status ?? "sin dato"}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Referencia
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">{booking.id.toUpperCase()}</p>
        <p className="mt-1 text-xs text-muted-foreground">ID interno de seguimiento</p>
      </div>
    </div>
  </div>
);
