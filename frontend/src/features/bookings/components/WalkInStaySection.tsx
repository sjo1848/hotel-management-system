import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalkInStaySectionProps } from "@/features/bookings/components/WalkInShared";

export const WalkInStaySection = ({
  checkIn,
  checkOut,
  minCheckIn,
  nights,
  onCheckInChange,
  onCheckOutChange,
}: WalkInStaySectionProps) => (
  <div className="rounded-3xl border border-border bg-background/70 p-5 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <p className="text-sm font-black text-foreground">Estadia</p>
          <p className="text-sm text-muted-foreground">
            Defini entrada y salida para consultar disponibilidad real.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="walkin-check-in">Check-in</Label>
            <Input
              id="walkin-check-in"
              type="date"
              value={checkIn}
              min={minCheckIn}
              onChange={(event) => onCheckInChange(event.target.value)}
              className="h-11 rounded-xl"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="walkin-check-out">Check-out</Label>
            <Input
              id="walkin-check-out"
              type="date"
              value={checkOut}
              min={checkIn || minCheckIn}
              onChange={(event) => onCheckOutChange(event.target.value)}
              className="h-11 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Resumen de estancia
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {nights > 0 ? `${nights} ${nights === 1 ? "noche" : "noches"}` : "Fechas invalidas"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {checkIn && checkOut
              ? `${format(parseISO(checkIn), "dd/MM/yyyy")} -> ${format(parseISO(checkOut), "dd/MM/yyyy")}`
              : "Completa las fechas para continuar."}
          </p>
        </div>
      </div>
    </div>
  </div>
);
