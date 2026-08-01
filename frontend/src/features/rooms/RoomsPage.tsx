import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarRange,
  Check,
  CheckCircle,
  Grid,
  List,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import {
  bulkUpdateRoomStatus,
  getAllRooms,
  getRoomById,
  getRoomHoldBoard,
  updateRoomStatus,
} from "@/features/rooms/services/roomService";
import { getBookings } from "@/features/bookings/services/bookingService";
import type { Booking, Room, RoomHoldBoardEntry, RoomStatus } from "@/types/domain";
import BookingDrawer from "@/features/bookings/components/BookingDrawer";
import RoomCreateDrawer from "./components/RoomCreateDrawer";
import AvailabilityPicker from "./components/AvailabilityPicker";
import RoomAdminSheet from "./components/RoomAdminSheet";
import RoomActionsMenu from "./components/RoomActionsMenu";
import RoomHoldsBoardPanel from "./components/RoomHoldsBoardPanel";
import RoomInventoryPlanner from "./components/RoomInventoryPlanner";
import {
  buildRoomStatusSummary,
  getRoomStatusBadge,
  getRoomStatusMeta,
} from "./components/roomPresentation";
import { useToast } from "@/components/ui/toast";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";
import { useAuth } from "@/features/auth/useAuth";
import { roleHasCapability } from "@/features/auth/capabilities";
import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";

const RoomsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [holdBoardStart, setHoldBoardStart] = useState(new Date().toISOString().slice(0, 10));
  const [holdBoardEnd, setHoldBoardEnd] = useState(
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [isAdminSheetOpen, setIsAdminSheetOpen] = useState(false);
  const [bookingDates, setBookingDates] = useState<{ from: string; to: string } | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState<null | "AVAILABLE" | "DIRTY" | "MAINTENANCE">(null);
  const canManageInventory = roleHasCapability(user?.role, "rooms.write");
  const canManageStatus = roleHasCapability(user?.role, "rooms.status.write");
  const canCreateBooking = roleHasCapability(user?.role, "bookings.write");

  const roomsQueryKey = useMemo(
    () => `rooms:list:${bookingDates?.from ?? "all"}:${bookingDates?.to ?? "all"}`,
    [bookingDates?.from, bookingDates?.to],
  );
  const {
    data: roomsData,
    isLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = useResourceQuery<Room[]>({
    queryKey: roomsQueryKey,
    queryFn: () => getAllRooms(bookingDates?.from, bookingDates?.to),
    staleTimeMs: 10_000,
  });
  const holdBoardQueryKey = useMemo(
    () => `rooms:holds-board:${holdBoardStart}:${holdBoardEnd}`,
    [holdBoardEnd, holdBoardStart],
  );
  const {
    data: holdBoardData,
    isLoading: isHoldBoardLoading,
    refetch: refetchHoldBoard,
  } = useResourceQuery<RoomHoldBoardEntry[]>({
    queryKey: holdBoardQueryKey,
    queryFn: () =>
      canManageInventory ? getRoomHoldBoard(holdBoardStart, holdBoardEnd) : Promise.resolve([]),
    staleTimeMs: 15_000,
  });
  const plannerBookingsQueryKey = useMemo(
    () => `rooms:planner-bookings:${holdBoardStart}:${holdBoardEnd}`,
    [holdBoardEnd, holdBoardStart],
  );
  const { data: plannerBookingsData, refetch: refetchPlannerBookings } = useResourceQuery<Booking[]>({
    queryKey: plannerBookingsQueryKey,
    queryFn: () => getBookings(holdBoardStart, holdBoardEnd),
    staleTimeMs: 15_000,
  });

  const rooms = useMemo(() => roomsData ?? [], [roomsData]);
  const holdBoard = useMemo(() => holdBoardData ?? [], [holdBoardData]);
  const plannerBookings = useMemo(() => plannerBookingsData ?? [], [plannerBookingsData]);
  const filteredRooms = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) => {
      return (
        room.room_number.toLowerCase().includes(term) ||
        room.room_type.toLowerCase().includes(term) ||
        room.status.toLowerCase().includes(term)
      );
    });
  }, [rooms, searchQuery]);
  const summary = useMemo(() => buildRoomStatusSummary(rooms), [rooms]);
  const allFilteredSelected =
    filteredRooms.length > 0 && filteredRooms.every((room) => selectedRoomIds.includes(room.id));
  const holdsByType = useMemo(
    () =>
      holdBoard.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.hold_type] = (acc[entry.hold_type] ?? 0) + 1;
        return acc;
      }, {}),
    [holdBoard],
  );
  const dominantHoldType = useMemo(() => {
    return Object.entries(holdsByType).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  }, [holdsByType]);

  useEffect(() => {
    setSelectedRoomIds((current) => current.filter((id) => rooms.some((room) => room.id === id)));
  }, [rooms]);

  const refreshRooms = async () => {
    invalidateResource(roomsQueryKey);
    invalidateResource(holdBoardQueryKey);
    invalidateResource(plannerBookingsQueryKey);
    await refetchRooms();
    if (canManageInventory) {
      await refetchHoldBoard();
    }
    await refetchPlannerBookings();
  };

  const handleSearchAvailability = (from: string, to: string) => {
    setBookingDates({ from, to });
    setIsSearching(true);
  };

  const handleClearSearch = () => {
    setBookingDates(null);
    setIsSearching(false);
  };

  const handleBookingSuccess = async () => {
    await refreshRooms();
  };

  const handleUpdateStatus = async (
    roomId: string,
    status: "AVAILABLE" | "DIRTY",
  ) => {
    try {
      await updateRoomStatus(roomId, status);
      toast({ title: "Estado actualizado", variant: "success" });
      await refreshRooms();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo actualizar el estado"),
        variant: "error",
      });
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds((current) =>
      current.includes(roomId)
        ? current.filter((id) => id !== roomId)
        : [...current, roomId],
    );
  };

  const toggleAllFilteredRooms = () => {
    setSelectedRoomIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredRooms.some((room) => room.id === id));
      }
      const next = new Set(current);
      filteredRooms.forEach((room) => next.add(room.id));
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedRoomIds([]);

  const handleBulkStatusUpdate = async (
    status: "AVAILABLE" | "DIRTY" | "MAINTENANCE",
    successLabel: string,
  ) => {
    if (selectedRoomIds.length === 0) {
      return;
    }

    setBulkUpdatingStatus(status);
    try {
      const result = await bulkUpdateRoomStatus(selectedRoomIds, status);
      toast({
        title: "Accion masiva aplicada",
        description: `${result.updated_count} habitaciones pasaron a ${successLabel}.`,
        variant: "success",
      });
      clearSelection();
      await refreshRooms();
    } catch (error: unknown) {
      toast({
        title: "No se pudo aplicar la accion masiva",
        description: getErrorMessage(error, "Revisa las habitaciones seleccionadas e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      setBulkUpdatingStatus(null);
    }
  };

  const openRoomAdmin = (room: Room) => {
    setSelectedRoom(room);
    setIsAdminSheetOpen(true);
  };

  const openRoomAdminFromBoard = async (roomId: string) => {
    const existing = rooms.find((room) => room.id === roomId);
    if (existing) {
      openRoomAdmin(existing);
      return;
    }

    try {
      const room = await getRoomById(roomId);
      openRoomAdmin(room);
    } catch (error: unknown) {
      toast({
        title: "No se pudo abrir la habitacion",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    }
  };

  const openBooking = (room: Room) => {
    setSelectedRoom(room);
    setIsBookingDrawerOpen(true);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const columns: Column<Room>[] = [
    {
      header: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label="Seleccionar habitaciones visibles"
            checked={allFilteredSelected}
            onChange={toggleAllFilteredRooms}
            className="h-4 w-4 rounded border-border text-primary"
          />
        </div>
      ),
      className: "w-12",
      cell: (room) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            aria-label={`Seleccionar habitacion ${room.room_number}`}
            checked={selectedRoomIds.includes(room.id)}
            onChange={() => toggleRoomSelection(room.id)}
            className="h-4 w-4 rounded border-border text-primary"
          />
        </div>
      ),
    },
    {
      header: "Habitacion",
      cell: (room) => {
        const statusMeta = getRoomStatusMeta(room.status);
        return (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm",
                statusMeta.accentClassName,
              )}
            >
              {room.room_number}
            </div>
            <div>
              <div className="font-semibold text-foreground">Habitacion {room.room_number}</div>
              <div className="text-xs text-muted-foreground">{room.room_type}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Estado",
      cell: (room) => getRoomStatusBadge(room.status),
      className: "w-40",
    },
    {
      header: "Tarifa base",
      cell: (room) => (
        <span className="font-mono font-medium text-foreground">
          ${(room.price_cents / 100).toLocaleString("es-AR")}
        </span>
      ),
      className: "w-40",
    },
    {
      header: "Gestion",
      className: "w-[220px]",
      cell: (room) => (
        <div className="flex items-center justify-end gap-2">
          {room.status === "Available" && canCreateBooking ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-emerald-500/20 bg-emerald-500/10 text-xs font-bold uppercase text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
              onClick={() => openBooking(room)}
            >
              Reservar
            </Button>
          ) : null}
          {(canManageInventory || canManageStatus) ? (
            <RoomActionsMenu
              status={room.status}
              canEdit={canManageInventory}
              canChangeStatus={canManageStatus}
              onViewDetails={() => openRoomAdmin(room)}
              onEdit={canManageInventory ? () => openRoomAdmin(room) : undefined}
              onChangeStatus={(status) => handleUpdateStatus(room.id, status)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const getSelectedStatusSummary = () => {
    const selected = rooms.filter((room) => selectedRoomIds.includes(room.id));
    const breakdown = selected.reduce<Record<RoomStatus, number>>(
      (acc, room) => {
        acc[room.status] += 1;
        return acc;
      },
      {
        Available: 0,
        Occupied: 0,
        Dirty: 0,
        Cleaning: 0,
        Maintenance: 0,
      },
    );
    return breakdown;
  };

  const selectedSummary = useMemo(getSelectedStatusSummary, [rooms, selectedRoomIds]);
  const operationalTasks = useMemo(
    () => [
      {
        label: "Fuera de venta",
        value: summary.maintenance + summary.dirty,
        helper:
          summary.maintenance > 0
            ? `${summary.maintenance} en mantenimiento y ${summary.dirty} en limpieza.`
            : `${summary.dirty} habitaciones siguen en limpieza o preparacion.`,
        icon: AlertTriangle,
        tone: "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        cta: canManageStatus ? "Ordenar turno" : "Revisar estado",
        onClick: () => scrollToSection("rooms-planner"),
      },
      {
        label: "Listas para vender",
        value: summary.available,
        helper:
          summary.available > 0
            ? `Tarifa promedio ${(summary.avgRate / 100).toLocaleString("es-AR")} para inventario activo.`
            : "No hay habitaciones disponibles en este momento.",
        icon: Sparkles,
        tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        cta: canCreateBooking ? "Buscar disponibilidad" : "Ver inventario",
        onClick: () => scrollToSection("rooms-availability"),
      },
      {
        label: "Bloqueos proximos",
        value: holdBoard.length,
        helper:
          holdBoard.length > 0
            ? dominantHoldType
              ? `Predomina ${dominantHoldType.toLowerCase()} en el rango seleccionado.`
              : "Hay habitaciones retenidas fuera de venta."
            : "No hay bloqueos cargados en el rango actual.",
        icon: CalendarRange,
        tone: "border-primary/20 bg-primary/10 text-primary",
        cta: canManageInventory ? "Ver timeline" : "Revisar rango",
        onClick: () => scrollToSection("rooms-holds-board"),
      },
    ],
    [
      canCreateBooking,
      canManageInventory,
      canManageStatus,
      dominantHoldType,
      holdBoard.length,
      summary.available,
      summary.avgRate,
      summary.dirty,
      summary.maintenance,
    ],
  );

  const statCards = [
    {
      label: "Disponibles",
      value: summary.available,
      hint: "listas para vender",
      icon: CheckCircle,
      tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Ocupadas",
      value: summary.occupied,
      hint: "con estancia activa",
      icon: BedDouble,
      tone: "text-destructive bg-destructive/10 border-destructive/20",
    },
    {
      label: "Limpieza",
      value: summary.dirty,
      hint: "requieren atencion",
      icon: Sparkles,
      tone: "text-amber-700 bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Mantenimiento",
      value: summary.maintenance,
      hint: "fuera de venta",
      icon: Wrench,
      tone: "text-muted-foreground bg-muted/70 border-border",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habitaciones"
        description="Centro de gestion para admins y operaciones: inventario, estado comercial y acciones diarias sin duplicar flujos."
        icon={<BedDouble className="h-5 w-5" />}
        actions={
          <>
            <div className="flex w-full items-center rounded-xl border border-border bg-muted p-1 sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 flex-1 rounded-lg px-3 sm:flex-none",
                  viewMode === "grid"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("grid")}
              >
                <Grid className="mr-2 h-4 w-4" />
                Grid
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 flex-1 rounded-lg px-3 sm:flex-none",
                  viewMode === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("list")}
              >
                <List className="mr-2 h-4 w-4" />
                Lista
              </Button>
            </div>
            {canManageInventory ? (
              <Button className="h-10 w-full rounded-xl shadow-lg sm:w-auto" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva habitacion
              </Button>
            ) : null}
          </>
        }
      />

      <section className="stagger-list grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionEyebrow>Prioridades del inventario</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
                Que conviene resolver ahora
              </h2>
              <p className="mt-2 max-w-[54ch] text-sm text-muted-foreground">
                Primero destraba habitaciones fuera de venta, despues limpia bloqueos y recien
                despues baja al inventario completo.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Foco del turno
              </p>
              <p className="mt-2 font-semibold text-foreground">
                {summary.available > 0
                  ? `${summary.available} habitaciones listas para vender.`
                  : "No hay inventario libre para venta inmediata."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.maintenance + summary.dirty > 0
                  ? `${summary.maintenance + summary.dirty} piezas todavia consumen atencion operativa.`
                  : "El inventario operativo esta limpio para el turno."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operationalTasks.map((task) => {
              const Icon = task.icon;
              return (
                <button
                  key={task.label}
                  type="button"
                  onClick={task.onClick}
                  className={cn(
                    "group rounded-3xl border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    task.tone,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <SectionEyebrow className="text-current">{task.label}</SectionEyebrow>
                      <p className="text-3xl font-black tracking-tight">{task.value}</p>
                    </div>
                    <div className="rounded-2xl bg-card/90 p-3 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm opacity-90">{task.helper}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]">
                    {task.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <SectionCard className="xl:col-span-1">
            <SectionEyebrow>Inventario total</SectionEyebrow>
            <p className="mt-3 text-4xl font-black tracking-tight text-foreground">{summary.total}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              habitaciones activas con tarifa promedio de ${(summary.avgRate / 100).toLocaleString("es-AR")}
            </p>
          </SectionCard>
          <SectionCard>
            <SectionEyebrow>Accion recomendada</SectionEyebrow>
            <p className="mt-3 text-xl font-black tracking-tight text-foreground">
              {summary.maintenance > 0
                ? "Recuperar habitaciones en mantenimiento"
                : summary.dirty > 0
                  ? "Cerrar limpieza pendiente"
                  : "Abrir disponibilidad al turno"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.maintenance > 0
                ? "Mira primero las habitaciones fuera de venta y su timeline de bloqueos."
                : summary.dirty > 0
                ? "La siguiente mejora de ocupacion sale de housekeeping."
                  : "El cuello de botella ya no esta en inventario sino en recepcion/comercial."}
            </p>
          </SectionCard>
        </div>
      </section>

      <section className="stagger-list grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-3xl border p-5 shadow-sm", stat.tone)}>
              <div className="flex items-start justify-between">
                <div>
                  <SectionEyebrow className="text-current">{stat.label}</SectionEyebrow>
                  <p className="mt-3 text-3xl font-black tracking-tight">{stat.value}</p>
                  <p className="mt-2 text-sm opacity-80">{stat.hint}</p>
                </div>
                <div className="rounded-2xl bg-card p-3 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <div id="rooms-planner" key={`${holdBoardStart}:${holdBoard.length}`} className="motion-refresh">
        <RoomInventoryPlanner
          rooms={filteredRooms}
          holds={holdBoard}
          bookings={plannerBookings}
          startDate={holdBoardStart}
          onManageRoom={openRoomAdminFromBoard}
        />
      </div>

      {canManageInventory ? (
        <div id="rooms-holds-board" key={holdBoardQueryKey} className="motion-refresh">
          <RoomHoldsBoardPanel
            holds={holdBoard}
            loading={isHoldBoardLoading}
            startDate={holdBoardStart}
            endDate={holdBoardEnd}
            onStartDateChange={setHoldBoardStart}
            onEndDateChange={setHoldBoardEnd}
            onManageRoom={openRoomAdminFromBoard}
          />
        </div>
      ) : null}

      {canManageStatus && selectedRoomIds.length > 0 ? (
        <section
          id="housekeeping-priority"
          className="rounded-3xl border border-primary/20 bg-primary/5 p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                Accion masiva
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-black text-foreground">
                  {selectedRoomIds.length} habitaciones seleccionadas
                </p>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Disp. {selectedSummary.Available}
                </span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Limpieza {selectedSummary.Dirty + selectedSummary.Cleaning}
                </span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Mant. {selectedSummary.Maintenance}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSummary.Maintenance > 0
                  ? "Las incidencias Maintenance se resuelven individualmente desde Housekeeping."
                  : "Usa esto para mover inventario completo sin entrar habitación por habitación."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                disabled={bulkUpdatingStatus !== null || selectedSummary.Maintenance > 0}
                onClick={() => void handleBulkStatusUpdate("AVAILABLE", "disponible")}
              >
                {bulkUpdatingStatus === "AVAILABLE" ? <Check className="h-4 w-4 animate-pulse" /> : null}
                Marcar disponibles
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                disabled={bulkUpdatingStatus !== null || selectedSummary.Maintenance > 0}
                onClick={() => void handleBulkStatusUpdate("DIRTY", "limpieza")}
              >
                {bulkUpdatingStatus === "DIRTY" ? <Check className="h-4 w-4 animate-pulse" /> : null}
                Enviar a limpieza
              </Button>
              <Button variant="ghost" className="h-10 rounded-xl" onClick={clearSelection}>
                Limpiar seleccion
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <div id="rooms-availability">
        <AvailabilityPicker onSearch={handleSearchAvailability} onClear={handleClearSearch} />
      </div>

      {isSearching ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">
              Mostrando disponibilidad para {bookingDates?.from} al {bookingDates?.to}
            </p>
            <p className="mt-1 text-xs font-medium text-primary/80">
              {filteredRooms.length} habitaciones encontradas en el rango seleccionado.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full border-primary/20 bg-background/90 sm:w-auto"
            onClick={handleClearSearch}
          >
            Ver inventario completo
          </Button>
        </div>
      ) : null}

      {viewMode === "list" ? (
        <DataTable
          columns={columns}
          data={filteredRooms}
          isLoading={isLoading}
          searchable
          searchPlaceholder="Buscar por numero, tipo o estado..."
          onSearch={setSearchQuery}
          emptyMessage="No hay habitaciones que coincidan con la busqueda actual."
          error={roomsError}
          onRetry={refreshRooms}
          actions={
            canManageInventory ? (
              <Button size="sm" className="h-9 rounded-xl" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Añadir habitacion
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {roomsError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {roomsError}
            </div>
          ) : null}

          {!isLoading && filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/40 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm">
                <BedDouble className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">
                No hay habitaciones para mostrar
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Ajusta las fechas o el buscador para revisar otra parte del inventario.
              </p>
            </div>
          ) : null}

          {isLoading ? (
            <div className="stagger-list grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="h-[220px] rounded-3xl border border-border bg-muted animate-pulse" />
              ))}
            </div>
          ) : null}

          {!isLoading && filteredRooms.length > 0 ? (
            <div className="stagger-list grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRooms.map((room) => {
                const statusMeta = getRoomStatusMeta(room.status);
                return (
                  <article
                    key={room.id}
                    className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    {canManageStatus ? (
                      <label className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 shadow-sm">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar habitacion ${room.room_number}`}
                          checked={selectedRoomIds.includes(room.id)}
                          onChange={() => toggleRoomSelection(room.id)}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                      </label>
                    ) : null}
                    <div
                      className={cn(
                        "absolute right-0 top-0 h-24 w-24 -translate-y-1/3 translate-x-1/3 rounded-full opacity-15 blur-2xl transition-transform duration-500 group-hover:scale-150",
                        statusMeta.accentClassName,
                      )}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <div
                          className={cn(
                            "inline-flex rounded-2xl px-3 py-1.5 text-sm font-black text-white shadow-md",
                            statusMeta.accentClassName,
                          )}
                        >
                          {room.room_number}
                        </div>
                        <h3 className="mt-4 text-lg font-black tracking-tight text-foreground">
                          {room.room_type}
                        </h3>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Habitacion lista para gestion comercial y operativa
                        </p>
                      </div>
                      {(canManageInventory || canManageStatus) ? (
                        <RoomActionsMenu
                          status={room.status}
                          canEdit={canManageInventory}
                          canChangeStatus={canManageStatus}
                          onViewDetails={() => openRoomAdmin(room)}
                          onEdit={canManageInventory ? () => openRoomAdmin(room) : undefined}
                          onChangeStatus={(status) => handleUpdateStatus(room.id, status)}
                        />
                      ) : null}
                    </div>

                    <div className="relative mt-5 flex items-center justify-between">
                      {getRoomStatusBadge(room.status)}
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          Tarifa base
                        </p>
                        <p className="mt-1 font-mono text-lg font-bold text-foreground">
                          ${(room.price_cents / 100).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>

                    <div className="relative mt-6 grid gap-2">
                      {room.status === "Available" && canCreateBooking ? (
                        <Button className="h-10 rounded-xl" onClick={() => openBooking(room)}>
                          Reservar ahora
                        </Button>
                      ) : null}
                      {canManageInventory ? (
                        <Button
                          variant="outline"
                          className="h-10 rounded-xl"
                          onClick={() => openRoomAdmin(room)}
                        >
                          Gestionar habitacion
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {canManageInventory ? (
                <button
                  type="button"
                  className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30 p-5 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="mt-4 text-sm font-bold uppercase tracking-[0.2em]">
                    Agregar habitacion
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <BookingDrawer
        room={selectedRoom}
        dates={bookingDates}
        isOpen={isBookingDrawerOpen}
        onClose={() => setIsBookingDrawerOpen(false)}
        onSuccess={handleBookingSuccess}
      />

      <RoomCreateDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={refreshRooms}
      />

      <RoomAdminSheet
        room={selectedRoom}
        open={isAdminSheetOpen}
        canManageInventory={canManageInventory}
        canManageStatus={canManageStatus}
        onOpenChange={setIsAdminSheetOpen}
        onSaved={refreshRooms}
      />
    </div>
  );
};

export default RoomsPage;
