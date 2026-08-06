import type { KeyboardEvent } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FrontDeskQueueItem } from "@/types/domain";

export const badgeVariantForLane = (
  item: FrontDeskQueueItem,
): "success" | "warning" | "info" | "neutral" | "outline" => {
  switch (item.action_kind) {
    case "prepare-check-in":
      return "success";
    default:
      if (item.lane === "Bloqueada") return "warning";
      if (item.lane === "Salida") return "info";
      if (item.lane === "En casa") return "neutral";
      return "outline";
  }
};

type ReceptionQueueItemProps = {
  item: FrontDeskQueueItem;
  index: number;
  total: number;
  selected: boolean;
  active: boolean;
  busy: boolean;
  onOpen: (bookingId: string) => void;
  onPrepareCheckIn: (bookingId: string) => void;
  innerRef?: (node: HTMLDivElement | null) => void;
};

export const ReceptionQueueItem = ({
  item,
  index,
  total,
  selected,
  active,
  busy,
  onOpen,
  onPrepareCheckIn,
  innerRef,
}: ReceptionQueueItemProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(item.entry.booking_id);
    }
  };

  return (
    <div
      ref={innerRef}
      role="option"
      aria-selected={selected}
      tabIndex={active ? 0 : -1}
      onClick={() => onOpen(item.entry.booking_id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer rounded-2xl border px-3 py-3 shadow-sm transition",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/30 hover:bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant={badgeVariantForLane(item)} className="shrink-0">
            {item.lane}
          </Badge>
          <span className="truncate text-sm font-black tracking-tight text-foreground">
            {item.entry.guest_name}
          </span>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          Hab. {item.entry.room_number} · {item.entry.room_type}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {item.title} · {item.detail}
        </p>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Caso {index + 1} de {total}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        {selected ? (
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            <Check className="h-3.5 w-3.5" />
            Seleccionado
          </span>
        ) : busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : item.action_kind === "prepare-check-in" ? (
          <Button
            type="button"
            size="sm"
            className="min-h-9 rounded-xl"
            onClick={(event) => {
              event.stopPropagation();
              onPrepareCheckIn(item.entry.booking_id);
            }}
          >
            Hacer check-in
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            Revisar
            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </div>
  );
};
