import { Fragment, useMemo, useState } from "react";
import { addDays, eachDayOfInterval, format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";
import { getRoomHoldMeta } from "./roomHoldPresentation";
import { getRoomStatusBadge, getRoomStatusMeta } from "./roomPresentation";

type RoomInventoryPlannerProps = {
  rooms: Room[];
  holds: RoomHoldBoardEntry[];
  bookings: Booking[];
  startDate: string;
  onManageRoom: (roomId: string) => void;
};

type PlannerRow = {
  room: Room;
  holds: RoomHoldBoardEntry[];
  bookings: Booking[];
};

const isWithinDayRange = (date: Date, start: string, end: string) =>
  isWithinInterval(date, {
    start: parseISO(start),
    end: addDays(parseISO(end), -1),
  });

const RoomInventoryPlanner = ({
  rooms,
  holds,
  bookings,
  startDate,
  onManageRoom,
}: RoomInventoryPlannerProps) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  const plannerDays = useMemo(() => {
    const safeStart = parseISO(startDate);
    return eachDayOfInterval({
      start: safeStart,
      end: addDays(safeStart, 6),
    });
  }, [startDate]);

  const rows = useMemo<PlannerRow[]>(() => {
    return rooms
      .map((room) => ({
        room,
        holds: holds
          .filter((entry) => entry.room_id === room.id)
          .sort((left, right) => left.start_date.localeCompare(right.start_date)),
        bookings: bookings
          .filter(
            (entry) =>
              entry.room_id === room.id &&
              entry.status !== "Cancelled" &&
              entry.status !== "NoShow",
          )
          .sort((left, right) => left.check_in.localeCompare(right.check_in)),
      }))
      .sort((left, right) =>
        left.room.room_number.localeCompare(right.room.room_number, "es", {
          numeric: true,
        }),
      );
  }, [bookings, holds, rooms]);

  const occupancySummary = useMemo(() => {
    const futureBookedRooms = new Set(
      rows.flatMap((row) => row.bookings.map((entry) => entry.room_id)),
    ).size;
    const checkedInCount = rows.reduce(
      (sum, row) => sum + row.bookings.filter((entry) => entry.status === "CheckedIn").length,
      0,
    );
    return { futureBookedRooms, checkedInCount };
  }, [rows]);

  const selectedDate = plannerDays[selectedDayOffset];

  const dayCellContent = (
    row: PlannerRow,
    date: Date,
  ): { holds: RoomHoldBoardEntry[]; bookings: Booking[] } => ({
    holds: row.holds.filter((entry) => isWithinDayRange(date, entry.start_date, entry.end_date)),
    bookings: row.bookings.filter((entry) =>
      isWithinDayRange(date, entry.check_in, entry.check_out),
    ),
  });

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <SectionEyebrow className="text-foreground">Planner operativo 7 días</SectionEyebrow>
            <p className="max-w-[58ch] text-sm text-muted-foreground">
              Vista rápida de la semana para detectar inventario fuera de venta, holds activos y el
              estado actual de cada habitación sin bajar al detalle completo.
            </p>
          </div>
        </div>
        <div className="motion-live-pill rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Ventana visible
          </p>
          <p className="mt-2 font-semibold text-foreground">
            {format(plannerDays[0], "dd MMM", { locale: es })} al{" "}
            {format(plannerDays[plannerDays.length - 1], "dd MMM", { locale: es })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Usa la timeline completa de bloqueos abajo para ampliar rango y editar fechas.
          </p>
          <p className="mt-2 text-xs font-semibold text-foreground">
            {occupancySummary.futureBookedRooms} habitaciones con ocupación futura visible ·{" "}
            {occupancySummary.checkedInCount} estancias activas en la ventana.
          </p>
        </div>
      </div>

      <div className="motion-refresh mt-5 hidden overflow-x-auto rounded-2xl border border-border bg-background/60 md:block">
        <div
          className="grid min-w-[860px] gap-px bg-border"
          style={{
            gridTemplateColumns: `minmax(210px, 250px) repeat(${plannerDays.length}, minmax(74px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 bg-card px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Habitación
          </div>
          {plannerDays.map((date) => (
            <div
              key={date.toISOString()}
              className="bg-card px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              <div>{format(date, "dd", { locale: es })}</div>
              <div className="mt-1 text-[9px]">{format(date, "EEE", { locale: es })}</div>
            </div>
          ))}

          {rows.map(({ room, holds: roomHolds, bookings: roomBookings }) => {
            const statusMeta = getRoomStatusMeta(room.status);
            return (
              <Fragment key={room.id}>
                <div className="sticky left-0 z-10 bg-card px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`inline-flex rounded-2xl px-3 py-1.5 text-sm font-black text-white shadow-sm ${statusMeta.accentClassName}`}
                        >
                          {room.room_number}
                        </div>
                        {getRoomStatusBadge(room.status)}
                      </div>
                      <p className="mt-3 text-sm font-black text-foreground">{room.room_type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {roomHolds.length > 0
                          ? `${roomHolds.length} bloqueo(s) en la ventana visible.`
                          : roomBookings.length > 0
                            ? `${roomBookings.length} reserva(s) proyectadas en la semana visible.`
                            : "Sin bloqueos ni reservas visibles en esta semana."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="motion-surface h-9 rounded-xl px-3 text-xs"
                      onClick={() => onManageRoom(room.id)}
                    >
                      Gestionar
                    </Button>
                  </div>
                </div>

                {plannerDays.map((date) => {
                  const { holds: activeHolds, bookings: activeBookings } = dayCellContent(
                    { room, holds: roomHolds, bookings: roomBookings },
                    date,
                  );
                  const isPlannerToday = isSameDay(date, new Date());

                  return (
                    <div
                      key={`${room.id}-${date.toISOString()}`}
                      className={`bg-card px-2 py-3 ${isPlannerToday ? "ring-1 ring-inset ring-primary/20" : ""}`}
                    >
                      <div className="flex min-h-[72px] flex-col gap-1.5">
                        {isPlannerToday ? (
                          <div className="motion-live-pill rounded-lg border border-border bg-background/80 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
                            Hoy
                          </div>
                        ) : (
                          <div className="h-[26px]" />
                        )}

                        {activeHolds.length > 0 ? (
                          activeHolds.map((entry) => {
                            const meta = getRoomHoldMeta(entry.hold_type);
                            return (
                              <div
                                key={`${entry.hold_id}-${date.toISOString()}`}
                                className="rounded-lg px-2 py-1 text-[10px] font-bold text-white shadow-sm"
                                style={{ backgroundColor: meta.color }}
                                title={`${meta.label}: ${entry.reason}`}
                              >
                                {meta.label}
                              </div>
                            );
                          })
                        ) : null}

                        {activeBookings.length > 0 ? (
                          activeBookings.slice(0, 2).map((entry) => {
                            const isCheckedIn = entry.status === "CheckedIn";
                            return (
                              <div
                                key={`${entry.id}-${date.toISOString()}`}
                                className={
                                  isCheckedIn
                                    ? "rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground shadow-sm"
                                    : "rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-700 shadow-sm dark:text-sky-200"
                                }
                                title={
                                  isCheckedIn
                                    ? "Estancia activa"
                                    : `Reserva ${entry.check_in} al ${entry.check_out}`
                                }
                              >
                                {isCheckedIn ? "Hospedado" : "Reserva"}
                              </div>
                            );
                          })
                        ) : null}

                        {activeHolds.length === 0 && activeBookings.length === 0 ? (
                          isPlannerToday ? (
                            <div className="rounded-lg border border-dashed border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                              Estado actual
                            </div>
                          ) : (
                            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 text-[10px] text-muted-foreground/70">
                              Libre
                            </div>
                          )
                        ) : null}

                        {activeBookings.length > 2 ? (
                          <div className="rounded-lg border border-border bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                            +{activeBookings.length - 2} más
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="mt-5 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="h-9 w-9 shrink-0 rounded-xl p-0"
            aria-label="Día anterior"
            onClick={() =>
              setSelectedDayOffset((current) => Math.max(0, current - 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 gap-1 overflow-x-auto rounded-xl border border-border bg-muted p-1">
            {plannerDays.map((date, index) => {
              const active = index === selectedDayOffset;
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  aria-pressed={active}
                  className={`h-10 min-w-[52px] flex-1 rounded-lg text-xs font-bold transition ${
                    active
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  }`}
                  onClick={() => setSelectedDayOffset(index)}
                >
                  {format(date, "EEE dd", { locale: es })}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            className="h-9 w-9 shrink-0 rounded-xl p-0"
            aria-label="Día siguiente"
            onClick={() =>
              setSelectedDayOffset((current) => Math.min(plannerDays.length - 1, current + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map(({ room, holds: roomHolds, bookings: roomBookings }) => {
            const { holds: activeHolds, bookings: activeBookings } = dayCellContent(
              { room, holds: roomHolds, bookings: roomBookings },
              selectedDate,
            );
            return (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-foreground">
                      {room.room_number}
                    </span>
                    {getRoomStatusBadge(room.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{room.room_type}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeHolds.map((entry) => {
                      const meta = getRoomHoldMeta(entry.hold_type);
                      return (
                        <span
                          key={entry.hold_id}
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.label}
                        </span>
                      );
                    })}
                    {activeBookings.length > 0 ? (
                      <span className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-200">
                        {activeBookings.some((entry) => entry.status === "CheckedIn")
                          ? "Hospedado"
                          : "Reserva"}
                      </span>
                    ) : null}
                    {activeHolds.length === 0 && activeBookings.length === 0 ? (
                      <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Libre
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-9 shrink-0 rounded-xl text-xs"
                  onClick={() => onManageRoom(room.id)}
                >
                  Ver detalle
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="motion-live-pill inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Estado de hoy visible en la primera fecha
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Los bloques coloreados representan holds activos
        </div>
        <button
          type="button"
          onClick={() => {
            const element = document.getElementById("rooms-holds-board");
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="motion-surface inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 font-semibold text-foreground transition hover:border-primary/30 hover:text-primary"
        >
          Ir a timeline completa
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </SectionCard>
  );
};

export default RoomInventoryPlanner;
