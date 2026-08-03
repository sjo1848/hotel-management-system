import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FrontDeskQueueItem } from "@/types/domain";
import { ReceptionQueueItem } from "./ReceptionQueueItem";

const SkeletonRow = () => (
  <div className="animate-pulse rounded-2xl border border-border bg-card px-3 py-3 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-3 w-24 rounded bg-muted" />
    </div>
    <div className="mt-2 h-3 w-64 max-w-full rounded bg-muted" />
  </div>
);

type ReceptionQueueListProps = {
  items: FrontDeskQueueItem[];
  selectedBookingId?: string;
  busyBookingId?: string;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onRetry: () => void;
  onOpen: (bookingId: string) => void;
  onPrepareCheckIn: (bookingId: string) => void;
  ariaLabel: string;
  summaryText?: string;
};

export const ReceptionQueueList = ({
  items,
  selectedBookingId,
  busyBookingId,
  loading,
  error,
  emptyMessage,
  onRetry,
  onOpen,
  onPrepareCheckIn,
  ariaLabel,
  summaryText,
}: ReceptionQueueListProps) => {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusableBookingId = selectedBookingId ?? items[0]?.entry.booking_id;

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = event.currentTarget.ownerDocument.activeElement as HTMLElement | null;
    if (!current) return;
    const index = items.findIndex(
      (item) => rowRefs.current.get(item.entry.booking_id) === current,
    );
    if (index === -1) return;
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(index + 1, items.length - 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(index - 1, 0);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    else return;
    const nextItem = items[nextIndex];
    if (!nextItem || nextIndex === index) return;
    event.preventDefault();
    rowRefs.current.get(nextItem.entry.booking_id)?.focus();
  };

  let content: ReactNode;
  if (loading) {
    content = (
      <div role="status" aria-label={`Cargando ${ariaLabel}`} className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm">
        <p className="font-semibold text-foreground">No se pudo cargar la cola</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3 h-9 rounded-xl" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  } else {
    content = (
      <div role="listbox" aria-label={ariaLabel} className="space-y-2" onKeyDown={handleListKeyDown}>
        {items.map((item, index) => (
          <ReceptionQueueItem
            key={item.entry.booking_id}
            item={item}
            index={index}
            total={items.length}
            selected={item.entry.booking_id === selectedBookingId}
            active={item.entry.booking_id === focusableBookingId}
            busy={item.entry.booking_id === busyBookingId}
            onOpen={onOpen}
            onPrepareCheckIn={onPrepareCheckIn}
            innerRef={(node) => {
              if (node) rowRefs.current.set(item.entry.booking_id, node);
              else rowRefs.current.delete(item.entry.booking_id);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <section aria-label={ariaLabel} className="space-y-3">
      {summaryText ? (
        <p className="text-sm font-semibold text-foreground">{summaryText}</p>
      ) : null}
      {content}
    </section>
  );
};
