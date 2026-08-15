import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Booking, Room } from "@/types/domain";
import type { CalendarAllocation, CalendarConflict } from "./calendarModel";

type Props = {
  rooms: Room[];
  dates: string[];
  allocationsByRoom: Map<string, CalendarAllocation[]>;
  conflicts: CalendarConflict[];
  onSelect: (allocation: CalendarAllocation | CalendarConflict) => void;
  onRoom: (room: Room) => void;
};

const statusLabel = (booking: Booking) => ({
  Confirmed: "Confirmada",
  CheckedIn: "En casa",
  CheckedOut: "Finalizada",
  Cancelled: "Cancelada",
  NoShow: "No-show",
} as Record<Booking["status"], string>)[booking.status] ?? booking.status;

const CalendarTimeline = ({ rooms, dates, allocationsByRoom, conflicts, onSelect, onRoom }: Props) => {
  const conflictKeys = new Set(conflicts.map((conflict) => `${conflict.roomId}:${conflict.date}`));
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="min-w-[860px] w-full border-collapse" aria-label="Timeline de ocupación">
        <caption className="sr-only">Habitaciones, reservas y bloqueos por noche</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 min-w-[210px] border-b border-r border-border bg-card px-4 py-3 text-left text-xs font-bold text-muted-foreground">Habitación</th>
            {dates.map((date) => (
              <th scope="col" key={date} className="min-w-[74px] border-b border-r border-border bg-card px-2 py-3 text-center text-xs font-bold text-muted-foreground">
                <span className="block uppercase">{format(parseISO(date), "EEE", { locale: es })}</span>
                <span className="mt-1 block text-sm text-foreground">{format(parseISO(date), "dd")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const allocations = allocationsByRoom.get(room.id) ?? [];
            return (
              <tr key={room.id}>
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-h-11 text-left" onClick={() => onRoom(room)} aria-label={`Ver habitación ${room.room_number}`}>
                      <span className="block font-black text-foreground">{room.room_number}</span>
                      <span className="block text-xs text-muted-foreground">{room.room_type}</span>
                      <span className="mt-1 block text-xs font-semibold text-foreground">Estado actual: {room.status}</span>
                    </button>
                    {room.status === "Maintenance" ? <Wrench className="mt-1 h-4 w-4 text-amber-600" aria-label="Mantenimiento" /> : null}
                    {room.status === "Dirty" ? <AlertTriangle className="mt-1 h-4 w-4 text-amber-600" aria-label="Limpieza" /> : null}
                  </div>
                </th>
                {dates.map((date) => {
                  const active = allocations.filter((allocation) => allocation.startDate <= date && date < allocation.endDate);
                  const conflict = conflictKeys.has(`${room.id}:${date}`);
                  return (
                    <td key={date} className="h-20 border-b border-r border-border p-1 align-middle">
                      {conflict ? (
                        <Button type="button" variant="destructive" className="h-11 w-full rounded-lg px-1 text-[10px]" onClick={() => onSelect(conflicts.find((item) => item.roomId === room.id && item.date === date)!)}>
                          <AlertTriangle className="mr-1 h-3 w-3" /> Conflicto
                        </Button>
                      ) : active.length === 0 ? (
                        <span className="sr-only">Sin asignación</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {active.map((allocation) => {
                            const label = allocation.kind === "hold" ? allocation.hold.hold_type : `${allocation.booking.guest_name} · ${statusLabel(allocation.booking)}`;
                            return (
                              <button key={`${allocation.kind}-${allocation.kind === "hold" ? allocation.hold.hold_id : allocation.booking.id}`} type="button" onClick={() => onSelect(allocation)} className={`min-h-11 w-full rounded-lg border px-1 text-left text-[10px] font-bold leading-tight ${allocation.kind === "hold" ? "border-dashed border-amber-600 bg-amber-100 text-amber-900" : "border-indigo-600 bg-indigo-600 text-white"} ${label.length > 12 ? "line-clamp-2 whitespace-normal" : "whitespace-nowrap"}`} aria-label={`${allocation.kind === "hold" ? "Bloqueo" : "Reserva"}: ${label}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CalendarTimeline;
