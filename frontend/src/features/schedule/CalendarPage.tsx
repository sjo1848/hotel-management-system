import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { AuthContext } from "@/features/auth/AuthContext";
import { roleHasCapability } from "@/features/auth/capabilities";
import { listRooms, getRoomHoldBoard } from "@/features/rooms/services/roomService";
import { getBookings, updateBooking } from "@/features/bookings/services/bookingService";
import BookingDetailsSheet from "@/features/bookings/components/BookingDetailsSheet";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";
import CalendarAgenda from "./CalendarAgenda";
import CalendarTimeline from "./CalendarTimeline";
import {
  buildCalendarAllocations,
  calendarSummary,
  type CalendarAllocation,
  type CalendarConflict,
} from "./calendarModel";

type CalendarMode = "timeline" | "agenda";
type RangeDays = 7 | 14 | 30;

const CalendarPage = () => {
  const { user } = useContext(AuthContext);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const canUpdate = roleHasCapability(user?.role, "bookings.update");
  const canReadRooms = roleHasCapability(user?.role, "rooms.read");
  const today = format(startOfToday(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [rangeDays, setRangeDays] = useState<RangeDays>(14);
  const [mode, setMode] = useState<CalendarMode>("agenda");
  const [modeTouched, setModeTouched] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [onlyConflicts, setOnlyConflicts] = useState(false);
  const [onlyOutOfService, setOnlyOutOfService] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ includeInactive: false, onlyConflicts: false, onlyOutOfService: false });
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedContext, setSelectedContext] = useState<CalendarAllocation | CalendarConflict | null>(null);
  const selectionReturnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modeTouched) setMode(isDesktop ? "timeline" : "agenda");
    else if (!isDesktop) setMode("agenda");
  }, [isDesktop, modeTouched]);

  useEffect(() => {
    if (!isDesktop && mode === "timeline") setMode("agenda");
  }, [isDesktop, mode]);

  const endDate = useMemo(() => format(addDays(parseISO(startDate), rangeDays), "yyyy-MM-dd"), [rangeDays, startDate]);
  const dateKeys = useMemo(() => buildCalendarAllocations([], [], [], { startDate, rangeDays }).dates, [rangeDays, startDate]);
  useEffect(() => setSelectedDate(dateKeys[0] ?? startDate), [dateKeys, startDate]);

  const roomsQuery = useResourceQuery<Room[]>({ queryKey: "calendar:rooms", queryFn: listRooms, staleTimeMs: 30_000, retry: false });
  const bookingsKey = `calendar:bookings:${startDate}:${endDate}`;
  const bookingsQuery = useResourceQuery<Booking[]>({ queryKey: bookingsKey, queryFn: () => getBookings(startDate, endDate), retry: false });
  const holdsKey = `calendar:holds:${startDate}:${endDate}`;
  const holdsQuery = useResourceQuery<RoomHoldBoardEntry[]>({ queryKey: holdsKey, queryFn: () => getRoomHoldBoard(startDate, endDate), enabled: canReadRooms, retry: false });

  const rooms = roomsQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const holds = holdsQuery.data ?? [];
  const model = useMemo(() => buildCalendarAllocations(rooms, bookings, holds, { startDate, rangeDays }, includeInactive), [bookings, holds, includeInactive, rangeDays, rooms, startDate]);
  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const allocations = model.allocationsByRoom.get(room.id) ?? [];
    const searchable = `${room.room_number} ${room.room_type} ${allocations.map((item) => item.kind === "booking" ? item.booking.guest_name : item.hold.hold_type).join(" ")}`.toLowerCase();
    if (search && !searchable.includes(search.toLowerCase())) return false;
    if (onlyOutOfService && room.status !== "Dirty" && room.status !== "Maintenance") return false;
    if (onlyConflicts && !model.conflicts.some((conflict) => conflict.roomId === room.id)) return false;
    return true;
  }).sort((left, right) => left.room_number.localeCompare(right.room_number, "es", { numeric: true })), [model, onlyConflicts, onlyOutOfService, rooms, search]);
  const filteredRoomIds = new Set(filteredRooms.map((room) => room.id));
  const filteredItems = useMemo(() => (model.allocationsByDate.get(selectedDate) ?? []).filter((item) => filteredRoomIds.has(item.room.id)), [filteredRoomIds, model.allocationsByDate, selectedDate]);
  const summary = useMemo(() => calendarSummary({ ...model, allocationsByRoom: new Map([...model.allocationsByRoom].filter(([roomId]) => filteredRoomIds.has(roomId))) }, filteredRooms), [filteredRoomIds, filteredRooms, model]);
  const hasLoading = roomsQuery.isLoading || bookingsQuery.isLoading || (canReadRooms && holdsQuery.isLoading);
  const retryAll = () => {
    void roomsQuery.refetch();
    void bookingsQuery.refetch();
    if (canReadRooms) void holdsQuery.refetch();
  };
  const moveRange = (delta: number) => setStartDate(format(addDays(parseISO(startDate), delta * rangeDays), "yyyy-MM-dd"));
  const selectContext = (context: CalendarAllocation | CalendarConflict) => {
    selectionReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedContext(context);
    if ("kind" in context && context.kind === "booking") setSelectedBooking(context.booking);
    else setSelectedBooking(null);
  };
  const clearFilters = () => { setSearch(""); setIncludeInactive(false); setOnlyConflicts(false); setOnlyOutOfService(false); };
  const openMobileFilters = () => {
    setDraftFilters({ includeInactive, onlyConflicts, onlyOutOfService });
    setMobileFiltersOpen(true);
  };
  const discardMobileFilters = () => {
    setDraftFilters({ includeInactive, onlyConflicts, onlyOutOfService });
    setMobileFiltersOpen(false);
  };
  const applyMobileFilters = () => {
    setIncludeInactive(draftFilters.includeInactive);
    setOnlyConflicts(draftFilters.onlyConflicts);
    setOnlyOutOfService(draftFilters.onlyOutOfService);
    setMobileFiltersOpen(false);
  };

  return (
    <div className="space-y-5">
      {isMobile ? <div className="flex min-h-11 items-center justify-between gap-3" aria-label="Encabezado compacto del calendario"><div className="min-w-0"><h1 className="truncate text-base font-black text-foreground">Calendario</h1><p className="truncate text-xs text-muted-foreground">Agenda operativa</p></div><Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="Actualizar calendario" onClick={retryAll} disabled={hasLoading}><RefreshCw className={`h-4 w-4 ${hasLoading ? "animate-spin" : ""}`} /></Button></div> : <PageHeader title="Calendario" description="Ocupación, movimientos y bloqueos por fecha" icon={<CalendarDays className="h-5 w-5" />} actions={<Button type="button" variant="outline" className="h-10 rounded-xl" onClick={retryAll} disabled={hasLoading}><RefreshCw className="h-4 w-4" />{hasLoading ? "Actualizando…" : "Actualizar"}</Button>} />}
      <SectionCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isMobile ? <>
            <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Rango anterior" onClick={() => moveRange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => { setStartDate(today); setSelectedDate(today); }}>Hoy</Button>
            <span className="min-w-[64px] flex-1 whitespace-nowrap rounded-xl bg-muted px-2 py-2 text-center text-sm font-bold text-foreground" aria-live="polite">{format(parseISO(startDate), "dd MMM", { locale: es })}</span>
            <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Rango siguiente" onClick={() => moveRange(1)}><ChevronRight className="h-4 w-4" /></Button>
            <label className="sr-only" htmlFor="calendar-range-mobile">Rango de agenda</label>
            <select id="calendar-range-mobile" aria-label="Rango de agenda" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value) as RangeDays)} className="min-h-11 w-[78px] shrink-0 rounded-xl border border-input bg-background px-2 text-sm font-semibold">
              {[7, 14, 30].map((days) => <option key={days} value={days}>{days} días</option>)}
            </select>
          </> : <>
            <Button type="button" variant="outline" className="min-h-11" aria-label="Anterior" onClick={() => moveRange(-1)}><ChevronLeft className="h-4 w-4" />Anterior</Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => { setStartDate(today); setSelectedDate(today); }}>Hoy</Button>
            <Button type="button" variant="outline" className="min-h-11" aria-label="Siguiente" onClick={() => moveRange(1)}>Siguiente<ChevronRight className="h-4 w-4" /></Button>
            <span className="rounded-xl bg-muted px-3 py-2 text-sm font-bold text-foreground" aria-live="polite">{format(parseISO(startDate), "dd MMM", { locale: es })}–{format(addDays(parseISO(startDate), rangeDays - 1), "dd MMM", { locale: es })}</span>
            <div role="group" className="ml-auto flex rounded-xl border border-border bg-muted p-1" aria-label="Cantidad de días">{([7, 14, 30] as const).map((days) => <button key={days} type="button" aria-pressed={rangeDays === days} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${rangeDays === days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setRangeDays(days)}>{days} días</button>)}</div>
          </>}
          {isDesktop ? <div role="group" className="flex rounded-xl border border-border bg-muted p-1" aria-label="Modo de calendario"><button type="button" aria-pressed={mode === "timeline"} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${mode === "timeline" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60"}`} onClick={() => { setMode("timeline"); setModeTouched(true); }}>Timeline</button><button type="button" aria-pressed={mode === "agenda"} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${mode === "agenda" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => { setMode("agenda"); setModeTouched(true); }}>Agenda</button></div> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input aria-label="Buscar habitación o huésped" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Habitación o huésped" className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm md:col-span-1" />
          {isDesktop ? <>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />Incluir canceladas/no-show</label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={onlyConflicts} onChange={(event) => setOnlyConflicts(event.target.checked)} />Sólo conflictos</label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={onlyOutOfService} onChange={(event) => setOnlyOutOfService(event.target.checked)} />Fuera de servicio</label>
          </> : <Sheet open={mobileFiltersOpen} onOpenChange={(open) => open ? openMobileFilters() : discardMobileFilters()}>
            <SheetTrigger asChild><Button type="button" variant="outline" className="min-h-11 justify-center" onClick={openMobileFilters}><Filter className="h-4 w-4" />Filtros{(includeInactive || onlyConflicts || onlyOutOfService) ? " (activos)" : ""}</Button></SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl px-4 pb-6">
              <SheetHeader className="text-left"><SheetTitle>Filtros del calendario</SheetTitle><SheetDescription>Reducí la agenda a las operaciones que necesitás revisar.</SheetDescription></SheetHeader>
              <div className="mt-5 grid gap-3">
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={draftFilters.includeInactive} onChange={(event) => setDraftFilters((current) => ({ ...current, includeInactive: event.target.checked }))} />Incluir canceladas/no-show</label>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={draftFilters.onlyConflicts} onChange={(event) => setDraftFilters((current) => ({ ...current, onlyConflicts: event.target.checked }))} />Sólo conflictos</label>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-input px-3 text-sm"><input type="checkbox" checked={draftFilters.onlyOutOfService} onChange={(event) => setDraftFilters((current) => ({ ...current, onlyOutOfService: event.target.checked }))} />Fuera de servicio</label>
              </div>
              <SheetFooter className="mt-6 flex-row justify-between gap-2"><Button type="button" variant="ghost" onClick={() => setDraftFilters({ includeInactive: false, onlyConflicts: false, onlyOutOfService: false })}>Limpiar</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={discardMobileFilters}>Cancelar</Button><Button type="button" onClick={applyMobileFilters}>Aplicar filtros</Button></div></SheetFooter>
            </SheetContent>
          </Sheet>}
        </div>
        {(search || includeInactive || onlyConflicts || onlyOutOfService) ? <Button type="button" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button> : null}
        {isMobile ? <details className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Resumen del rango</summary><div className="mt-2 grid grid-cols-2 gap-2" aria-label="Resumen del rango"><span>{summary.bookings} reservas activas</span><span>{summary.arrivals} llegadas</span><span>{summary.departures} salidas</span><span>{summary.holds} bloqueos</span><span>{summary.conflicts} conflictos</span><span>{summary.rooms} habitaciones</span></div></details> : <div role="group" className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground" aria-label="Resumen del rango"><span>{summary.bookings} reservas activas</span><span>{summary.arrivals} llegadas</span><span>{summary.departures} salidas</span><span>{summary.holds} bloqueos</span><span>{summary.conflicts} conflictos</span><span>{summary.rooms} habitaciones</span></div>}
      </SectionCard>
      {roomsQuery.error ? <SectionCard className="border-destructive/30"><p className="font-semibold text-destructive">No se pudieron cargar las habitaciones</p><Button type="button" variant="outline" onClick={() => void roomsQuery.refetch()}>Reintentar</Button></SectionCard> : null}
      {bookingsQuery.error ? <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-900">No se pudieron cargar las reservas <button type="button" className="ml-2 underline" onClick={() => void bookingsQuery.refetch()}>Reintentar</button></p> : null}
      {holdsQuery.error ? <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-900">No se pudieron cargar los bloqueos <button type="button" className="ml-2 underline" onClick={() => void holdsQuery.refetch()}>Reintentar</button></p> : null}
      {hasLoading ? <SectionCard><div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando planificación…</div></SectionCard> : mode === "timeline" ? <CalendarTimeline rooms={filteredRooms} dates={model.dates} allocationsByRoom={model.allocationsByRoom} conflicts={model.conflicts} onSelect={selectContext} onRoom={(room) => setSelectedContext({ kind: "hold", hold: { hold_id: `room-${room.id}`, room_id: room.id, room_number: room.room_number, room_type: room.room_type, start_date: startDate, end_date: endDate, hold_type: "Other", reason: `Estado actual: ${room.status}` }, startDate, endDate })} /> : <CalendarAgenda dates={model.dates} selectedDate={selectedDate} items={filteredItems} conflicts={model.conflicts.filter((conflict) => filteredRoomIds.has(conflict.roomId))} onDateChange={setSelectedDate} onSelect={selectContext} />}
      {!hasLoading && !roomsQuery.error && !bookingsQuery.error && !holdsQuery.error && filteredItems.length === 0 ? <p role="status" className="mt-3 rounded-xl border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">No hay movimientos que mostrar en este rango. Ajustá el rango o los filtros.</p> : null}
      {selectedContext && !selectedBooking ? <SectionCard><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contexto seleccionado</p><h2 className="mt-1 text-lg font-black">{"hold" in selectedContext ? `Bloqueo · ${selectedContext.hold.hold_type}` : "Conflicto"}</h2><p className="mt-2 text-sm text-muted-foreground">{"hold" in selectedContext ? `${selectedContext.hold.reason} · ${selectedContext.hold.start_date} al ${selectedContext.hold.end_date}` : "allocations" in selectedContext ? `${selectedContext.allocations.length} elementos implicados en ${selectedContext.date}` : "Reserva seleccionada"}</p></div><Button type="button" variant="ghost" onClick={() => setSelectedContext(null)}>Cerrar</Button></div></SectionCard> : null}
      <BookingDetailsSheet booking={selectedBooking} isOpen={Boolean(selectedBooking)} onClose={() => { setSelectedBooking(null); setSelectedContext(null); requestAnimationFrame(() => selectionReturnFocusRef.current?.focus()); }} onUpdateStatus={canUpdate ? async (id, status, frontDesk) => { await updateBooking(id, { status, front_desk: frontDesk }); await bookingsQuery.refetch(); } : undefined} onRefreshBooking={() => bookingsQuery.refetch()} />
    </div>
  );
};

export default CalendarPage;
