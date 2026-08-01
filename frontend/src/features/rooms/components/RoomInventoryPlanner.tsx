import { Fragment, useMemo } from "react";
import { addDays, eachDayOfInterval, format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, CalendarRange } from "lucide-react";
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
  floorLabel: string;
  room: Room;
  holds: RoomHoldBoardEntry[];
  bookings: Booking[];
};

const getFloorLabel = (roomNumber: string) => {
  const digits = roomNumber.replace(/\D/g, "");
  if (digits.length >= 3) {
    return `Piso ${digits.slice(0, -2)}`;
  }
  if (digits.length === 2) {
    return `Piso ${digits.slice(0, 1)}`;
  }
  return "Sin piso";
};

const RoomInventoryPlanner = ({
  rooms,
  holds,
  bookings,
  startDate,
  onManageRoom,
}: RoomInventoryPlannerProps) => {
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
        floorLabel: getFloorLabel(room.room_number),
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
      .sort((left, right) => {
        if (left.floorLabel !== right.floorLabel) {
          return left.floorLabel.localeCompare(right.floorLabel, "es");
        }
        return left.room.room_number.localeCompare(right.room.room_number, "es");
      });
  }, [holds, rooms]);

  const groupedRows = useMemo(() => {
    return rows.reduce<Array<{ floorLabel: string; entries: PlannerRow[] }>>((acc, row) => {
      const current = acc.find((entry) => entry.floorLabel === row.floorLabel);
      if (current) {
        current.entries.push(row);
        return acc;
      }
      acc.push({ floorLabel: row.floorLabel, entries: [row] });
      return acc;
    }, []);
  }, [rows]);

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

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <SectionEyebrow className="text-foreground">Planner operativo 7 dias</SectionEyebrow>
            <p className="max-w-[58ch] text-sm text-muted-foreground">
              Vista rapida por piso para detectar inventario fuera de venta, holds activos y el
              estado actual de cada habitacion sin bajar al detalle completo.
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
            {occupancySummary.futureBookedRooms} habitaciones con ocupacion futura visible ·{" "}
            {occupancySummary.checkedInCount} estancias activas en la ventana.
          </p>
        </div>
      </div>

      <div className="motion-refresh mt-5 overflow-x-auto rounded-2xl border border-border bg-background/60">
        <div
          className="grid min-w-[760px] gap-px bg-border lg:min-w-[920px]"
          style={{
            gridTemplateColumns: `minmax(210px, 250px) repeat(${plannerDays.length}, minmax(74px, 1fr))`,
          }}
        >
          <div className="bg-card px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Habitacion / accion
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

          {groupedRows.map((group) => (
            <Fragment key={group.floorLabel}>
              <div className="col-span-full bg-muted/80 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {group.floorLabel}
              </div>

              {group.entries.map(({ room, holds: roomHolds, bookings: roomBookings }) => {
                const statusMeta = getRoomStatusMeta(room.status);
                return (
                  <Fragment key={room.id}>
                    <div className="bg-card px-4 py-4">
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
                          <p className="mt-3 text-sm font-black text-foreground">
                            {room.room_type}
                          </p>
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
                      const activeHolds = roomHolds.filter((entry) =>
                        isWithinInterval(date, {
                          start: parseISO(entry.start_date),
                          end: addDays(parseISO(entry.end_date), -1),
                        }),
                      );
                      const activeBookings = roomBookings.filter((entry) =>
                        isWithinInterval(date, {
                          start: parseISO(entry.check_in),
                          end: addDays(parseISO(entry.check_out), -1),
                        }),
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
                            ) : activeBookings.length > 0 ? (
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
                                    title={`${isCheckedIn ? "Hospedado" : "Reserva"}: ${entry.guest_name}`}
                                  >
                                    {isCheckedIn ? "Hospedado" : "Reserva"}
                                  </div>
                                );
                              })
                            ) : isPlannerToday ? (
                              <div className="rounded-lg border border-dashed border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                Estado actual
                              </div>
                            ) : (
                              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 text-[10px] text-muted-foreground/70">
                                Libre
                              </div>
                            )}

                            {activeBookings.length > 2 ? (
                              <div className="rounded-lg border border-border bg-background/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                +{activeBookings.length - 2} mas
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
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
