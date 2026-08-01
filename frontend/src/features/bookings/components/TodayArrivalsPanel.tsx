import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Booking, Room, RoomStatus } from "@/types/domain";
import roomService from "@/features/rooms/services/roomService";
import { cn } from "@/lib/utils";

type TodayArrivalsPanelProps = {
  bookings: Booking[];
  onOpenBooking: (booking: Booking) => void;
  onPrepareCheckIn?: (booking: Booking) => Promise<void> | void;
};

const roomStatusBadge = (status: RoomStatus | "Unknown") => {
  switch (status) {
    case "Available":
      return <Badge variant="success">Lista</Badge>;
    case "Dirty":
      return <Badge variant="warning">Sucio</Badge>;
    case "Cleaning":
      return <Badge variant="info">Limpieza</Badge>;
    case "Maintenance":
      return <Badge variant="neutral">Mantenimiento</Badge>;
    case "Occupied":
      return <Badge variant="destructive">Ocupada</Badge>;
    default:
      return <Badge variant="outline">Sin estado</Badge>;
  }
};

const getBlockingReason = (status: RoomStatus | "Unknown") => {
  switch (status) {
    case "Dirty":
      return "La habitacion sigue sucia.";
    case "Cleaning":
      return "Housekeeping aun no libero la habitacion.";
    case "Maintenance":
      return "La habitacion esta fuera de servicio.";
    case "Occupied":
      return "La habitacion sigue ocupada.";
    case "Unknown":
      return "No se pudo cargar el estado operativo.";
    default:
      return null;
  }
};

const TodayArrivalsPanel = ({
  bookings,
  onOpenBooking,
  onPrepareCheckIn,
}: TodayArrivalsPanelProps) => {
  const [roomMap, setRoomMap] = useState<Record<string, Room>>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const arrivals = useMemo(
    () =>
      bookings.filter(
        (booking) => booking.status === "Confirmed" && booking.check_in === today,
      ),
    [bookings, today],
  );

  useEffect(() => {
    if (arrivals.length === 0) {
      setRoomMap({});
      return;
    }

    let cancelled = false;
    setLoadingRooms(true);

    Promise.allSettled(
      arrivals.map(async (booking) => {
        const room = await roomService.getRoomById(booking.room_id);
        return [booking.room_id, room] as const;
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const nextMap: Record<string, Room> = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            const [roomId, room] = result.value;
            nextMap[roomId] = room;
          }
        });
        setRoomMap(nextMap);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRooms(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arrivals]);

  const arrivalsWithRoom = useMemo(
    () =>
      arrivals.map((booking) => {
        const room = roomMap[booking.room_id];
        const roomStatus: RoomStatus | "Unknown" = room?.status ?? "Unknown";
        const isReady = roomStatus === "Available";
        const blockingReason = getBlockingReason(roomStatus);

        return {
          booking,
          room,
          roomStatus,
          isReady,
          blockingReason,
        };
      }),
    [arrivals, roomMap],
  );

  const readyCount = arrivalsWithRoom.filter((item) => item.isReady).length;
  const blockedCount = arrivalsWithRoom.filter((item) => !item.isReady).length;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground">
                Llegadas de hoy
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recepcion puede ver quien esta listo para entrar y quien sigue bloqueado por la habitacion.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
              Listas
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{readyCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
              Bloqueadas
            </p>
            <p className="mt-2 text-2xl font-black text-amber-800">{blockedCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {loadingRooms ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando estado de habitaciones para las llegadas de hoy.
          </div>
        ) : arrivalsWithRoom.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No hay llegadas pendientes hoy.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cuando haya reservas confirmadas con check-in para hoy, apareceran aca.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {arrivalsWithRoom.map(({ booking, room, roomStatus, isReady, blockingReason }) => (
              <article
                key={booking.id}
                className={cn(
                  "rounded-3xl border p-4 shadow-sm transition-colors",
                  isReady ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Huesped
                    </p>
                    <h4 className="mt-2 text-lg font-black tracking-tight text-foreground">
                      {booking.guest_name}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reserva {booking.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  {roomStatusBadge(roomStatus)}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <BedDouble className="h-3.5 w-3.5" />
                      Habitacion
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {room ? `${room.room_number} · ${room.room_type}` : booking.room_id}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Estadia
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {format(parseISO(booking.check_in), "dd MMM", { locale: es })} al{" "}
                      {format(parseISO(booking.check_out), "dd MMM", { locale: es })}
                    </p>
                  </div>
                </div>

                {!isReady && blockingReason ? (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Bloqueo operativo</p>
                      <p className="mt-1 text-xs">{blockingReason}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Lista para check-in</p>
                      <p className="mt-1 text-xs">La habitacion esta disponible y recepcion puede abrir el checklist formal de ingreso.</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {isReady ? (
                    <Button
                      className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => void onPrepareCheckIn?.(booking)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Preparar check-in
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => onOpenBooking(booking)}
                  >
                    Gestionar reserva
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TodayArrivalsPanel;
