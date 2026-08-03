import { Fragment } from "react";
import { addDays, eachDayOfInterval, format, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarRange, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";
import type { RoomHoldBoardEntry, RoomHoldType } from "@/types/domain";
import { getRoomHoldBadge, getRoomHoldMeta } from "./roomHoldPresentation";

type RoomHoldsBoardPanelProps = {
  holds: RoomHoldBoardEntry[];
  loading: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onManageRoom: (roomId: string) => void;
};

const RoomHoldsBoardPanel = ({
  holds,
  loading,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onManageRoom,
}: RoomHoldsBoardPanelProps) => {
  const holdSummary = holds.reduce<Record<string, number>>((acc, hold) => {
    acc[hold.hold_type] = (acc[hold.hold_type] ?? 0) + 1;
    return acc;
  }, {});
  const safeEndDate = endDate >= startDate ? endDate : startDate;
  const timelineDates = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(safeEndDate),
  });
  const holdRows = holds.reduce<
    Array<{
      roomId: string;
      roomNumber: string;
      roomType: string;
      entries: RoomHoldBoardEntry[];
    }>
  >((acc, hold) => {
    const existing = acc.find((row) => row.roomId === hold.room_id);
    if (existing) {
      existing.entries.push(hold);
      return acc;
    }
    acc.push({
      roomId: hold.room_id,
      roomNumber: hold.room_number,
      roomType: hold.room_type,
      entries: [hold],
    });
    return acc;
  }, []);
  holdRows.sort((left, right) => left.roomNumber.localeCompare(right.roomNumber));

  return (
    <SectionCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <SectionEyebrow className="text-foreground">Timeline de bloqueos</SectionEyebrow>
            <p className="max-w-[52ch] text-sm text-muted-foreground">
              Primero detecta que piezas salen de venta, despues entra a la ficha de cada
              habitacion para corregir fechas, liberar cupos o reordenar mantenimiento.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Desde
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Hasta
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
        </div>
      </div>

      {!loading && holds.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(holdSummary).map(([type, count]) => (
            <div
              key={type}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              {getRoomHoldMeta(type as RoomHoldType).label}: {count} activas
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando bloqueos del rango...
          </div>
        ) : null}

        {!loading && holds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No hay habitaciones fuera de venta por bloqueos en este rango.
          </div>
        ) : null}

        {!loading && holdRows.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-border bg-background/60">
              <div
                className="grid min-w-[760px] gap-px bg-border md:min-w-[860px]"
                style={{
                  gridTemplateColumns: `minmax(180px, 220px) repeat(${timelineDates.length}, minmax(36px, 1fr))`,
                }}
              >
                <div className="bg-card px-4 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Habitacion / timeline
                </div>
                {timelineDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="bg-card px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    <div>{format(date, "dd", { locale: es })}</div>
                    <div className="mt-1 text-[9px]">{format(date, "MMM", { locale: es })}</div>
                  </div>
                ))}

                {holdRows.map((row) => (
                  <Fragment key={row.roomId}>
                    <div key={`${row.roomId}-meta`} className="bg-card px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-foreground">
                            Habitacion {row.roomNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.roomType}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl px-3 text-xs"
                          onClick={() => onManageRoom(row.roomId)}
                        >
                          Gestionar
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.entries.map((entry) => getRoomHoldBadge(entry.hold_type))}
                      </div>
                    </div>
                    {timelineDates.map((date) => {
                      const activeEntries = row.entries.filter((entry) =>
                        isWithinInterval(date, {
                          start: parseISO(entry.start_date),
                          end: addDays(parseISO(entry.end_date), -1),
                        }),
                      );

                      return (
                        <div key={`${row.roomId}-${date.toISOString()}`} className="bg-card px-1 py-2">
                          <div className="flex min-h-14 flex-col gap-1 md:min-h-16">
                            {activeEntries.map((entry) => {
                              const meta = getRoomHoldMeta(entry.hold_type);
                              return (
                                <div
                                  key={`${entry.hold_id}-${date.toISOString()}`}
                                  className="rounded-xl px-1.5 py-1 text-[9px] font-bold text-white shadow-sm md:px-2 md:text-[10px]"
                                  style={{ backgroundColor: meta.color }}
                                  title={`${entry.reason} · ${entry.start_date} al ${entry.end_date}`}
                                >
                                  <span className="hidden md:inline">{meta.label}</span>
                                  <span className="md:hidden">{meta.label.slice(0, 3)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {holds.map((hold) => {
                const holdMeta = getRoomHoldMeta(hold.hold_type);
                return (
                  <div
                    key={hold.hold_id}
                    className="flex flex-col gap-4 rounded-2xl border border-border bg-background/70 px-4 py-4 shadow-sm xl:flex-row xl:items-center xl:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getRoomHoldBadge(hold.hold_type)}
                        <p className="text-sm font-black text-foreground">
                          Habitacion {hold.room_number}
                        </p>
                        <p className="text-xs text-muted-foreground">{hold.room_type}</p>
                      </div>
                      <p className="text-sm text-foreground">{hold.reason}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {hold.start_date} al {hold.end_date}
                        </span>
                        <span>{holdMeta.description}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={() => onManageRoom(hold.room_id)}
                    >
                      Gestionar habitacion
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
};

export default RoomHoldsBoardPanel;
