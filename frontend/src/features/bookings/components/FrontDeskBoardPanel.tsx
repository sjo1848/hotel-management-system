import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
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
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/utils";
import { currency, stayRange } from "@/features/bookings/utils/format";
import { FrontDeskColumn } from "./FrontDeskColumn";
import {
  buildCockpitQueue,
  buildLaneIdSets,
  filterCockpitQueue,
  queueFilters,
  type QueueFilter,
} from "@/features/bookings/utils/cockpitQueue";
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
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const laneIds = useMemo(
    () => buildLaneIdSets(readyArrivals, blockedArrivals, departures, inHouse),
    [blockedArrivals, departures, inHouse, readyArrivals],
  );
  const cockpitQueue = useMemo(
    () =>
      buildCockpitQueue({
        actionQueue,
        readyArrivals,
        blockedArrivals,
        departures,
        inHouse,
      }),
    [actionQueue, blockedArrivals, departures, inHouse, readyArrivals],
  );
  const filteredQueue = useMemo(
    () =>
      filterCockpitQueue({
        queue: cockpitQueue,
        searchQuery,
        queueFilter,
        laneIds,
      }),
    [cockpitQueue, laneIds, queueFilter, searchQuery],
  );
  const boardCaseOrder = useMemo(
    () => Array.from(new Set(cockpitQueue.map((item) => item.entry.booking_id))),
    [cockpitQueue],
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
    () => filteredQueue.map((item) => item.entry.booking_id),
    [filteredQueue],
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
    <section className="motion-surface sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-sm">
      <div className="flex flex-col gap-3 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="hidden space-y-2 sm:block">
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

        <div className="grid w-full grid-cols-[1fr_auto] items-end gap-2 sm:flex sm:flex-row sm:gap-3 xl:w-auto">
          <div className="flex min-w-0 items-center rounded-xl border border-border bg-muted p-1 sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={viewMode === "queue" ? "h-9 flex-1 rounded-lg bg-card px-2 shadow-sm sm:h-8 sm:flex-none sm:px-3" : "h-9 flex-1 rounded-lg px-2 text-muted-foreground sm:h-8 sm:flex-none sm:px-3"}
              onClick={() => setViewMode("queue")}
            >
              <LayoutList className="h-4 w-4" />
              Cola
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={viewMode === "sections" ? "h-9 flex-1 rounded-lg bg-card px-2 shadow-sm sm:h-8 sm:flex-none sm:px-3" : "h-9 flex-1 rounded-lg px-2 text-muted-foreground sm:h-8 sm:flex-none sm:px-3"}
              onClick={() => setViewMode("sections")}
            >
              <LayoutPanelTop className="h-4 w-4" />
              Secciones
            </Button>
          </div>

          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:w-auto sm:gap-1.5 sm:text-xs sm:tracking-[0.18em]">
            <span className="sr-only sm:not-sr-only">Fecha operativa</span>
            <input
              type="date"
              aria-label="Fecha operativa"
              value={boardDate}
              onChange={(event) => onBoardDateChange(event.target.value)}
              className="h-11 w-[9.5rem] rounded-xl border border-input bg-background px-2 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 sm:h-10 sm:w-auto sm:px-3"
            />
          </label>
        </div>
      </div>

      <div className="stagger-list mt-5 hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Llegadas listas" value={readyArrivals.length} tone="success" icon={CheckCircle2} />
        <StatCard label="Llegadas bloqueadas" value={blockedArrivals.length} tone="warning" icon={ShieldAlert} />
        <StatCard label="Salidas del dia" value={departures.length} tone="info" icon={DoorClosed} />
        <StatCard label="En casa" value={inHouse.length} tone="neutral" icon={BedDouble} />
        <StatCard label="Bloqueos activos" value={holdsToday.length} tone="destructive" icon={CalendarDays} />
      </div>

      {viewMode === "queue" ? (
        <div className="mt-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm sm:mt-5 sm:rounded-3xl sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="front-desk-search"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
              >
                Buscar en el turno
              </label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="front-desk-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Huesped, habitacion o reserva"
                  className="h-11 w-full rounded-2xl border border-input bg-card pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>

            <div className="min-w-0 xl:max-w-[58%]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Filtrar casos
              </p>
              <div className="drawer-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" role="group" aria-label="Filtrar cola de recepcion">
                {queueFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant={queueFilter === filter.value ? "default" : "outline"}
                    className="h-9 shrink-0 rounded-xl"
                    aria-pressed={queueFilter === filter.value}
                    onClick={() => setQueueFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 hidden flex-col gap-1 border-t border-border pt-3 text-sm sm:flex sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-foreground">
              Mostrando {filteredQueue.length} de {cockpitQueue.length} casos del turno
            </p>
            <p className="text-xs text-muted-foreground">
              {blockedArrivals.length + departures.length} requieren atencion prioritaria
            </p>
          </div>
        </div>
      ) : null}

      {selectedBookingIds.length > 0 ? (
        <div className="motion-refresh mt-5 rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Seleccion operativa
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {selectedBookingIds.length} caso(s) en tu recorrido
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Abrí el primero y avanzá caso por caso sin volver al board.
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

      {!loading && holdsToday.length > 0 ? (
        <div className="stagger-list mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {holdsToday.slice(0, 4).map((hold) => (
            <div
              key={hold.hold_id}
              className="rounded-2xl border border-border bg-background/70 px-4 py-3 shadow-sm"
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
        <div className="mt-3 space-y-3 sm:mt-5">
          {filteredQueue.length > 0 ? (
            <div className="hidden flex-col gap-2 rounded-2xl border border-dashed border-border bg-background/50 px-4 py-3 text-sm sm:flex sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                Trabajá los casos en orden o seleccioná una cola para recorrerla sin volver al board.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" size="sm" className="rounded-xl sm:w-auto" onClick={selectVisibleQueue}>
                  Seleccionar resultados
                </Button>
                <Button type="button" variant="ghost" size="sm" className="rounded-xl sm:w-auto" onClick={clearSelection}>
                  Vaciar
                </Button>
              </div>
            </div>
          ) : null}
          {filteredQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              {cockpitQueue.length === 0
                ? "No hay casos pendientes para la fecha operativa seleccionada."
                : "No hay casos que coincidan con la busqueda y el filtro actuales."}
            </div>
          ) : (
            filteredQueue.map((item, index) => (
              <article
                key={`${item.lane}:${item.entry.booking_id}`}
                className="rounded-2xl border border-border bg-background/70 px-3 py-3 shadow-sm transition hover:border-primary/30 hover:bg-card sm:rounded-3xl sm:px-5 sm:py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <label className="hidden pt-1 sm:flex" title="Agregar caso a la cola de trabajo">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar caso de ${item.entry.guest_name}`}
                        className="h-4 w-4 rounded border-border text-primary"
                        checked={selectedBookingIds.includes(item.entry.booking_id)}
                        onChange={() => toggleSelection(item.entry.booking_id)}
                      />
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getQueueBadgeVariant(item)} className="w-fit">
                          {item.lane}
                        </Badge>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Caso {index + 1} de {filteredQueue.length}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-base font-black tracking-tight text-foreground">
                          {item.entry.guest_name}
                        </h4>
                        <p className="mt-1 text-sm text-foreground">
                          Hab. {item.entry.room_number} · {item.entry.room_type}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stayRange(item.entry.check_in, item.entry.check_out)} · Reserva {item.entry.booking_id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="hidden text-sm text-muted-foreground sm:block">{item.detail}</p>
                      {item.entry.blocker ? (
                        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-900 dark:text-amber-200">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-semibold">{item.entry.blocker.title}</p>
                            <p className="mt-1 text-xs">{item.entry.blocker.detail}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:min-w-[220px] sm:flex-col sm:items-stretch">
                    <div className="min-w-0 flex-1">
                      <p className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground sm:block">
                        Cuenta de referencia
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {currency(item.entry.total_price_cents)}
                      </p>
                    </div>
                    <Button
                      className="h-10 shrink-0 rounded-2xl"
                      onClick={() => {
                        if (item.action_kind === "prepare-check-in") {
                          prepareCheckInFromBoard(item.entry.booking_id);
                          return;
                        }
                        openBookingFromBoard(item.entry.booking_id);
                      }}
                    >
                      {getPrimaryActionLabel(item)}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <p className="hidden text-center text-xs text-muted-foreground sm:block">
                      Abre el caso con contexto y controles previos.
                    </p>
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

export default FrontDeskBoardPanel;

const getPrimaryActionLabel = (item: FrontDeskQueueItem) => {
  if (item.entry.blocker || item.lane === "Bloqueada") return "Revisar bloqueo";
  if (item.action_kind === "prepare-check-in") return "Hacer check-in";
  if (item.lane === "Salida") return "Preparar checkout";
  if (item.lane === "En casa") return "Gestionar estadia";
  return item.primary_label;
};

  const getQueueBadgeVariant = (item: FrontDeskQueueItem) => {
    switch (item.action_kind) {
      case "prepare-check-in":
        return "success" as const;
      default:
        if (item.lane === "Bloqueada") return "warning" as const;
        if (item.lane === "Salida") return "info" as const;
        if (item.lane === "En casa") return "neutral" as const;
        return "outline" as const;
    }
  };
