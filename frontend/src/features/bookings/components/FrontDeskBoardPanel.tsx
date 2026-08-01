import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  LayoutList,
  LayoutPanelTop,
  DoorClosed,
  Hotel,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/utils";
import type {
  FrontDeskBoard,
  FrontDeskBoardEntry,
  FrontDeskQueueItem,
} from "@/types/domain";

type FrontDeskBoardPanelProps = {
  board: FrontDeskBoard | null;
  loading: boolean;
  boardDate: string;
  onBoardDateChange: (value: string) => void;
  onOpenBooking: (bookingId: string, queueBookingIds?: string[]) => void;
  onPrepareCheckIn: (bookingId: string, queueBookingIds?: string[]) => void;
};

const currency = (value: number) => `$${(value / 100).toLocaleString("es-AR")}`;

const stayRange = (checkIn: string, checkOut: string) =>
  `${format(parseISO(checkIn), "dd MMM", { locale: es })} al ${format(parseISO(checkOut), "dd MMM", { locale: es })}`;

const FrontDeskBoardPanel = ({
  board,
  loading,
  boardDate,
  onBoardDateChange,
  onOpenBooking,
  onPrepareCheckIn,
}: FrontDeskBoardPanelProps) => {
  const readyArrivals = board?.arrivals_ready ?? [];
  const blockedArrivals = board?.arrivals_blocked ?? [];
  const departures = board?.departures_today ?? [];
  const inHouse = board?.in_house ?? [];
  const holdsToday = board?.holds_today ?? [];
  const actionQueue = board?.action_queue ?? [];
  const [viewMode, setViewMode] = useState<"queue" | "sections">("queue");
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const boardCaseOrder = useMemo(
    () => {
      if (actionQueue.length > 0) {
        return Array.from(new Set(actionQueue.map((item) => item.entry.booking_id)));
      }
      return Array.from(
        new Set(
          [...blockedArrivals, ...departures, ...readyArrivals, ...inHouse].map(
            (entry) => entry.booking_id,
          ),
        ),
      );
    },
    [actionQueue, blockedArrivals, departures, inHouse, readyArrivals],
  );
  const orderedSelectedBookingIds = useMemo(
    () => boardCaseOrder.filter((bookingId) => selectedBookingIds.includes(bookingId)),
    [boardCaseOrder, selectedBookingIds],
  );
  const getActiveQueueBookingIds = (bookingId?: string) => {
    const baseQueue = orderedSelectedBookingIds.length > 0 ? orderedSelectedBookingIds : boardCaseOrder;
    if (!bookingId) return baseQueue;
    if (baseQueue.includes(bookingId)) return baseQueue;
    return [bookingId, ...baseQueue];
  };
  const openBookingFromBoard = (bookingId: string) => {
    onOpenBooking(bookingId, getActiveQueueBookingIds(bookingId));
  };
  const prepareCheckInFromBoard = (bookingId: string) => {
    onPrepareCheckIn(bookingId, getActiveQueueBookingIds(bookingId));
  };
  const criticalQueue = useMemo(
    () =>
      actionQueue.slice(0, 4).map((item) => ({
        key: `${item.lane}:${item.entry.booking_id}`,
        title: item.title,
        detail: item.detail,
        actionLabel: item.primary_label,
        onAction: () => {
          if (item.action_kind === "prepare-check-in") {
            prepareCheckInFromBoard(item.entry.booking_id);
            return;
          }
          openBookingFromBoard(item.entry.booking_id);
        },
      })),
    [actionQueue, openBookingFromBoard, prepareCheckInFromBoard],
  );
  const operationalFocus = useMemo(() => {
    if (blockedArrivals.length > 0) {
      return "Destrabar llegadas antes de seguir vendiendo el turno.";
    }
    if (departures.length > 0) {
      return "Cerrar salidas y cobros pendientes para liberar habitaciones.";
    }
    if (readyArrivals.length > 0) {
      return "Convertir llegadas listas en check-ins cuanto antes.";
    }
    return "No hay urgencias activas: usa el board para seguimiento fino y contexto.";
  }, [blockedArrivals.length, departures.length, readyArrivals.length]);
  const visibleQueueBookingIds = useMemo(
    () => actionQueue.map((item) => item.entry.booking_id),
    [actionQueue],
  );
  const selectedEntries = useMemo(() => {
    const byId = new Map<string, FrontDeskBoardEntry>();
    [...readyArrivals, ...blockedArrivals, ...departures, ...inHouse].forEach((entry) => {
      byId.set(entry.booking_id, entry);
    });
    return selectedBookingIds
      .map((bookingId) => byId.get(bookingId))
      .filter((entry): entry is FrontDeskBoardEntry => Boolean(entry));
  }, [blockedArrivals, departures, inHouse, readyArrivals, selectedBookingIds]);
  const selectedReadyEntries = useMemo(
    () => selectedEntries.filter((entry) =>
      readyArrivals.some((readyEntry) => readyEntry.booking_id === entry.booking_id),
    ),
    [readyArrivals, selectedEntries],
  );
  const toggleSelection = (bookingId: string) => {
    setSelectedBookingIds((current) =>
      current.includes(bookingId)
        ? current.filter((id) => id !== bookingId)
        : [...current, bookingId],
    );
  };
  const selectVisibleQueue = () => {
    setSelectedBookingIds((current) => Array.from(new Set([...current, ...visibleQueueBookingIds])));
  };
  const clearSelection = () => setSelectedBookingIds([]);
  const selectLane = (entries: FrontDeskBoardEntry[]) => {
    setSelectedBookingIds((current) =>
      Array.from(new Set([...current, ...entries.map((entry) => entry.booking_id)])),
    );
  };
  const exportSelected = () => {
    if (selectedEntries.length === 0) return;
    downloadCSV(
      selectedEntries.map((entry) => ({
        booking_id: entry.booking_id,
        guest_name: entry.guest_name,
        room_number: entry.room_number,
        room_type: entry.room_type,
        booking_status: entry.booking_status,
        room_status: entry.room_status,
        check_in: entry.check_in,
        check_out: entry.check_out,
        total_price_cents: entry.total_price_cents,
        blocker_title: entry.blocker?.title ?? "",
        blocker_detail: entry.blocker?.detail ?? "",
      })),
      `front_desk_selection_${boardDate}.csv`,
    );
  };
  const openFirstSelected = () => {
    const firstEntry = selectedEntries[0];
    if (!firstEntry) return;
    onOpenBooking(firstEntry.booking_id, getActiveQueueBookingIds(firstEntry.booking_id));
  };
  const prepareSelectedReady = () => {
    const firstReadyEntry = selectedReadyEntries[0];
    if (!firstReadyEntry) return;
    onPrepareCheckIn(
      firstReadyEntry.booking_id,
      getActiveQueueBookingIds(firstReadyEntry.booking_id),
    );
  };

  return (
    <section className="motion-surface rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground">
              Turno de recepción
            </h3>
            <p className="max-w-[64ch] text-sm text-muted-foreground">
              Priorizá el turno desde acá: quién entra, qué caso está bloqueado, qué salida necesita cobro y qué estadías siguen en casa.
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{operationalFocus}</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end xl:w-auto">
          <div className="flex w-full items-center rounded-xl border border-border bg-muted p-1 sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={viewMode === "queue" ? "h-8 flex-1 rounded-lg bg-card px-3 shadow-sm sm:flex-none" : "h-8 flex-1 rounded-lg px-3 text-muted-foreground sm:flex-none"}
              onClick={() => setViewMode("queue")}
            >
              <LayoutList className="h-4 w-4" />
              Cola
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={viewMode === "sections" ? "h-8 flex-1 rounded-lg bg-card px-3 shadow-sm sm:flex-none" : "h-8 flex-1 rounded-lg px-3 text-muted-foreground sm:flex-none"}
              onClick={() => setViewMode("sections")}
            >
              <LayoutPanelTop className="h-4 w-4" />
              Secciones
            </Button>
          </div>

          <label className="grid w-full gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground sm:w-auto">
            Fecha operativa
            <input
              type="date"
              value={boardDate}
              onChange={(event) => onBoardDateChange(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 sm:w-auto"
            />
          </label>
        </div>
      </div>

      <div className="stagger-list mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Llegadas listas" value={readyArrivals.length} tone="success" icon={CheckCircle2} />
        <StatCard label="Llegadas bloqueadas" value={blockedArrivals.length} tone="warning" icon={ShieldAlert} />
        <StatCard label="Salidas del dia" value={departures.length} tone="info" icon={DoorClosed} />
        <StatCard label="En casa" value={inHouse.length} tone="neutral" icon={BedDouble} />
        <StatCard label="Bloqueos activos" value={holdsToday.length} tone="destructive" icon={CalendarDays} />
      </div>

      {selectedBookingIds.length > 0 ? (
        <div className="motion-refresh mt-5 rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Seleccion operativa
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {selectedBookingIds.length} caso(s) listos para trabajar en lote
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recepcion puede exportar la cola elegida o abrir el siguiente caso sin perder foco.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-2xl sm:w-auto"
                onClick={openFirstSelected}
              >
                <ArrowRight className="h-4 w-4" />
                Abrir primer caso
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-2xl sm:w-auto"
                onClick={prepareSelectedReady}
                disabled={selectedReadyEntries.length === 0}
              >
                <Check className="h-4 w-4" />
                Preparar check-in listo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-2xl sm:w-auto"
                onClick={exportSelected}
              >
                <Download className="h-4 w-4" />
                Exportar seleccion
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full rounded-2xl sm:w-auto"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {criticalQueue.length > 0 ? (
        <div className="motion-refresh mt-5 rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                Cola critica
              </p>
              <h4 className="mt-2 text-lg font-black tracking-tight text-foreground">
                Resolvé estos casos antes del resto del turno
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Mezcla bloqueos, salidas y llegadas listas en el orden que más impacto operativo tiene.
              </p>
            </div>
          </div>

          <div className="stagger-list mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {criticalQueue.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {item.title}
                </p>
                <p className="mt-3 min-h-[3rem] text-sm font-semibold text-foreground">
                  {item.detail}
                </p>
                <Button
                  className="mt-4 h-10 w-full rounded-2xl"
                  variant="outline"
                  onClick={item.onAction}
                >
                  {item.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && holdsToday.length > 0 ? (
        <div className="stagger-list mt-4 flex gap-3 overflow-x-auto pb-1">
          {holdsToday.slice(0, 4).map((hold) => (
            <div
              key={hold.hold_id}
              className="min-w-[200px] rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-sm sm:min-w-[220px]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Hold del dia
              </p>
              <p className="mt-2 text-sm font-black text-foreground">
                Hab. {hold.room_number} · {hold.room_type}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hold.reason}</p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando tablero operativo...
        </div>
      ) : viewMode === "queue" ? (
        <div className="mt-5 space-y-3">
          {actionQueue.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-background/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                Seleccioná varios casos y operalos como bloque seguro desde la barra superior.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" size="sm" className="rounded-xl sm:w-auto" onClick={selectVisibleQueue}>
                  Seleccionar visibles
                </Button>
                <Button type="button" variant="ghost" size="sm" className="rounded-xl sm:w-auto" onClick={clearSelection}>
                  Vaciar
                </Button>
              </div>
            </div>
          ) : null}
          {actionQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No hay casos urgentes para la fecha operativa seleccionada.
            </div>
          ) : (
            actionQueue.map((item) => (
              <article
                key={`${item.lane}:${item.entry.booking_id}`}
                className="rounded-2xl border border-border bg-background/70 px-4 py-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <label className="flex pt-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary"
                        checked={selectedBookingIds.includes(item.entry.booking_id)}
                        onChange={() => toggleSelection(item.entry.booking_id)}
                      />
                    </label>
                    <div className="space-y-2">
                      <Badge variant={getQueueBadgeVariant(item)} className="w-fit">
                        {item.lane}
                      </Badge>
                      <div>
                        <h4 className="text-base font-black tracking-tight text-foreground">
                          {item.entry.guest_name}
                        </h4>
                        <p className="mt-1 text-sm text-foreground">
                          Hab. {item.entry.room_number} · {item.entry.room_type}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                    <Badge variant={getQueueBadgeVariant(item)} className="w-fit">
                      {selectedBookingIds.includes(item.entry.booking_id) ? "Seleccionado" : item.title}
                    </Badge>
                    <Button
                      className="h-10 w-full rounded-2xl sm:w-auto"
                      onClick={() => {
                        if (item.action_kind === "prepare-check-in") {
                          prepareCheckInFromBoard(item.entry.booking_id);
                          return;
                        }
                        openBookingFromBoard(item.entry.booking_id);
                      }}
                    >
                      {item.primary_label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <FrontDeskColumn
            title="Llegadas listas"
            description="Reservas de hoy que ya pueden abrir check-in formal."
            empty="No hay llegadas listas para hoy."
            tone="success"
            entries={readyArrivals}
            selectedBookingIds={selectedBookingIds}
            onSelectLane={() => selectLane(readyArrivals)}
            onToggleSelection={toggleSelection}
            primaryLabel="Preparar check-in"
            onPrimaryAction={prepareCheckInFromBoard}
            onSecondaryAction={openBookingFromBoard}
          />
          <FrontDeskColumn
            title="Llegadas bloqueadas"
            description="Casos que recepcion no puede cerrar sin resolver habitacion o hold."
            empty="No hay llegadas bloqueadas."
            tone="warning"
            entries={blockedArrivals}
            selectedBookingIds={selectedBookingIds}
            onSelectLane={() => selectLane(blockedArrivals)}
            onToggleSelection={toggleSelection}
            primaryLabel="Resolver caso"
            onPrimaryAction={openBookingFromBoard}
            onSecondaryAction={openBookingFromBoard}
          />
          <FrontDeskColumn
            title="Salidas del dia"
            description="Estadias activas que deberian pasar por checkout formal."
            empty="No hay salidas pendientes en la fecha elegida."
            tone="info"
            entries={departures}
            selectedBookingIds={selectedBookingIds}
            onSelectLane={() => selectLane(departures)}
            onToggleSelection={toggleSelection}
            primaryLabel="Preparar checkout"
            onPrimaryAction={openBookingFromBoard}
            onSecondaryAction={openBookingFromBoard}
          />
          <FrontDeskColumn
            title="Huespedes en casa"
            description="Estadias activas con contexto rapido para excepciones o cambios."
            empty="No hay estadias activas para esa fecha."
            tone="neutral"
            entries={inHouse}
            selectedBookingIds={selectedBookingIds}
            onSelectLane={() => selectLane(inHouse)}
            onToggleSelection={toggleSelection}
            primaryLabel="Gestionar reserva"
            onPrimaryAction={openBookingFromBoard}
            onSecondaryAction={openBookingFromBoard}
          />
        </div>
      )}
    </section>
  );
};

type StatCardProps = {
  label: string;
  value: number;
  tone: "success" | "warning" | "info" | "neutral" | "destructive";
  icon: typeof CheckCircle2;
};

const toneMap: Record<StatCardProps["tone"], string> = {
  success: "border-primary/20 bg-primary/10 text-primary",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  info: "border-primary/20 bg-primary/10 text-primary",
  neutral: "border-border bg-background text-foreground",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
};

const StatCard = ({ label, value, tone, icon: Icon }: StatCardProps) => (
  <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneMap[tone]}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      </div>
      <div className="rounded-2xl bg-card p-2 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

type FrontDeskColumnProps = {
  title: string;
  description: string;
  empty: string;
  entries: FrontDeskBoardEntry[];
  selectedBookingIds: string[];
  tone: StatCardProps["tone"];
  onSelectLane: () => void;
  onToggleSelection: (bookingId: string) => void;
  primaryLabel: string;
  onPrimaryAction: (bookingId: string) => void;
  onSecondaryAction: (bookingId: string) => void;
};

const FrontDeskColumn = ({
  title,
  description,
  empty,
  entries,
  selectedBookingIds,
  tone,
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
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={onSelectLane}>
            Seleccionar carril
          </Button>
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
                <label className="flex pt-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary"
                    checked={selectedBookingIds.includes(entry.booking_id)}
                    onChange={() => onToggleSelection(entry.booking_id)}
                  />
                </label>
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
                variant={tone === "warning" ? "warning" : tone === "success" ? "success" : tone === "destructive" ? "destructive" : "outline"}
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

export default FrontDeskBoardPanel;
  const getQueueBadgeVariant = (item: FrontDeskQueueItem) => {
    switch (item.action_kind) {
      case "prepare-check-in":
        return "success" as const;
      default:
        if (item.lane === "Bloqueada") return "warning" as const;
        if (item.lane === "Salida") return "info" as const;
        return "outline" as const;
    }
  };
