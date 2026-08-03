import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FrontDeskBoardEntry } from "@/types/domain";
import { currency, stayRange } from "@/features/bookings/utils/format";

type FrontDeskColumnTone = "success" | "warning" | "info" | "neutral" | "destructive";

type FrontDeskColumnProps = {
  title: string;
  description: string;
  empty: string;
  entries: FrontDeskBoardEntry[];
  selectedBookingIds: string[];
  tone: FrontDeskColumnTone;
  selectable?: boolean;
  onSelectLane?: () => void;
  onToggleSelection?: (bookingId: string) => void;
  primaryLabel: string;
  onPrimaryAction: (bookingId: string) => void;
  onSecondaryAction: (bookingId: string) => void;
};

const badgeVariantForTone: Record<FrontDeskColumnTone, "warning" | "success" | "destructive" | "outline"> = {
  warning: "warning",
  success: "success",
  destructive: "destructive",
  info: "outline",
  neutral: "outline",
};

export const FrontDeskColumn = ({
  title,
  description,
  empty,
  entries,
  selectedBookingIds,
  tone,
  selectable = true,
  onSelectLane,
  onToggleSelection,
  primaryLabel,
  onPrimaryAction,
  onSecondaryAction,
}: FrontDeskColumnProps) => (
  <div className="rounded-3xl border border-border bg-background/60 p-4">
    <div className="mb-4">
      <h4 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">{title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {entries.length > 0 ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {entries.length} caso(s) en cola
          </p>
          {selectable ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={onSelectLane}>
              Seleccionar carril
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>

    {entries.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        {empty}
      </div>
    ) : (
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.booking_id} className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {selectable ? (
                  <label className="flex pt-1">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary"
                      checked={selectedBookingIds.includes(entry.booking_id)}
                      onChange={() => onToggleSelection?.(entry.booking_id)}
                    />
                  </label>
                ) : null}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Habitacion {entry.room_number}
                  </p>
                  <h5 className="mt-2 text-base font-black tracking-tight text-foreground">
                    {entry.guest_name}
                  </h5>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.room_type}</p>
                </div>
              </div>
              <Badge
                variant={badgeVariantForTone[tone]}
                className="shrink-0"
              >
                {entry.booking_status}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Estadia</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{stayRange(entry.check_in, entry.check_out)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Cuenta</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{currency(entry.total_price_cents)}</p>
              </div>
            </div>

            {entry.blocker ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{entry.blocker.title}</p>
                  <p className="mt-1 text-xs">{entry.blocker.detail}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button className="h-10 rounded-2xl sm:flex-1" onClick={() => onPrimaryAction(entry.booking_id)}>
                <ArrowRightLeft className="h-4 w-4" />
                {primaryLabel}
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-2xl sm:flex-1"
                onClick={() => onSecondaryAction(entry.booking_id)}
              >
                Abrir reserva
              </Button>
            </div>
          </article>
        ))}
      </div>
    )}
  </div>
);
