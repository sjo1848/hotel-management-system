import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import type { CalendarAgendaItem, CalendarAllocation, CalendarConflict } from "./calendarModel";

type Props = {
  dates: string[];
  selectedDate: string;
  items: CalendarAgendaItem[];
  conflicts: CalendarConflict[];
  onDateChange: (date: string) => void;
  onSelect: (item: CalendarAllocation | CalendarConflict) => void;
};

const groupLabel = (movement: CalendarAgendaItem["movement"]) => ({
  conflict: "Conflictos",
  arrival: "Llegadas",
  departure: "Salidas",
  stay: "En casa",
  hold: "Bloqueos",
}[movement]);

const CalendarAgenda = ({ dates, selectedDate, items, conflicts, onDateChange, onSelect }: Props) => {
  const selectedConflicts = conflicts.filter((conflict) => conflict.date === selectedDate);
  const groups = ["conflict", "arrival", "departure", "stay", "hold"] as const;
  return (
    <div className="space-y-4">
      <div role="group" className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-muted p-1" aria-label="Día de agenda">
        {dates.map((date) => (
          <button key={date} type="button" aria-pressed={selectedDate === date} onClick={() => onDateChange(date)} className={`min-h-11 min-w-[74px] rounded-lg px-3 text-xs font-bold ${selectedDate === date ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {format(parseISO(date), "EEE dd", { locale: es })}
          </button>
        ))}
      </div>
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.movement === group);
        const groupConflicts = group === "conflict" ? selectedConflicts : [];
        if (groupItems.length === 0 && groupConflicts.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`agenda-${group}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 id={`agenda-${group}`} className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{groupLabel(group)}</h3>
            <div className="mt-3 grid gap-2">
              {groupConflicts.map((conflict) => (
                <Button key={`${conflict.roomId}-${conflict.date}`} type="button" variant="destructive" className="min-h-11 justify-between" onClick={() => onSelect(conflict)}>
                  <span>Conflicto · habitación {conflict.roomId}</span><span>{conflict.allocations.length} elementos</span>
                </Button>
              ))}
              {groupItems.map((item) => {
                const label = item.kind === "hold" ? `${item.hold.hold_type} · ${item.hold.reason}` : `${item.booking.guest_name} · ${item.booking.status}`;
                return <Button key={`${item.kind}-${item.kind === "hold" ? item.hold.hold_id : item.booking.id}`} type="button" variant="outline" className="min-h-11 justify-between text-left" onClick={() => onSelect(item)}><span><strong>Habitación {item.room.room_number}</strong> · {label}</span><span>Ver detalle</span></Button>;
              })}
            </div>
          </section>
        );
      })}
      {items.length === 0 && selectedConflicts.length === 0 ? <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No hay movimientos ni bloqueos visibles para esta fecha</p> : null}
    </div>
  );
};

export default CalendarAgenda;
