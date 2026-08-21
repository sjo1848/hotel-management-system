import { Suspense, lazy, useMemo, useRef, useState } from "react";
import {
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Filter,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBookings, getFrontDeskBoard, updateBooking } from "./services/bookingService";
import { Booking, BookingFrontDeskData } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import { downloadCSV, cn } from "@/lib/utils";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";
import { PageHeader } from "@/components/ui/page-header";
import { useGuidedMode } from "@/features/guided/GuidedModeContext";
import CompactGuideAssistant from "@/features/guided/components/CompactGuideAssistant";
import type { ReceptionGuideStepId } from "@/features/guided/receptionGuide";
import { ReceptionWorkspace, type ReceptionWorkspaceView } from "./components/ReceptionWorkspace";
import { ReceptionQueueList } from "./components/ReceptionQueueList";
import { ReceptionShiftView } from "./components/ReceptionShiftView";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  buildCockpitQueue,
  buildLaneIdSets,
  filterCockpitQueue,
} from "./utils/cockpitQueue";

const BookingEditDrawer = lazy(() => import("./components/BookingEditDrawer"));
const BookingDetailsSheet = lazy(() => import("./components/BookingDetailsSheet"));
const FrontDeskBoardPanel = lazy(() => import("./components/FrontDeskBoardPanel"));
const WalkInBookingSheet = lazy(() => import("./components/WalkInBookingSheet"));

const BookingsPage = () => {
  const { toast } = useToast();
  const {
    enabled: guidedModeEnabled,
    setEnabled: setGuidedModeEnabled,
    resetReceptionGuide,
    trackReceptionEvent,
    getReceptionGuideState,
  } = useGuidedMode();
  const bookingQueryKey = "bookings:list";
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [boardDate, setBoardDate] = useState(new Date().toISOString().slice(0, 10));
  const [frontDeskQueueBookingIds, setFrontDeskQueueBookingIds] = useState<string[]>([]);
  const [guidedFocusStep, setGuidedFocusStep] = useState<ReceptionGuideStepId | null>(null);
  const [workspaceView, setWorkspaceView] = useState<ReceptionWorkspaceView>("shift");
  const detailsReturnRef = useRef<HTMLElement | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  const {
    data: bookingsData,
    isLoading: loading,
    error: bookingLoadError,
    refetch: refetchBookings,
  } = useResourceQuery<Booking[]>({
    queryKey: bookingQueryKey,
    queryFn: getBookings,
    staleTimeMs: 10_000,
  });

  const bookings = useMemo(() => bookingsData ?? [], [bookingsData]);
  const frontDeskQueryKey = useMemo(() => `front-desk:board:${boardDate}`, [boardDate]);
  const {
    data: frontDeskBoard,
    isLoading: frontDeskLoading,
    error: frontDeskError,
    refetch: refetchFrontDeskBoard,
  } = useResourceQuery({
    queryKey: frontDeskQueryKey,
    queryFn: () => getFrontDeskBoard(boardDate),
    staleTimeMs: 10_000,
  });

  const refreshBookingsView = async () => {
    await Promise.all([refetchBookings(), refetchFrontDeskBoard()]);
  };

  const handleExport = () => {
    if (bookings.length === 0) {
      toast({ title: "Sin datos", description: "No hay reservas para exportar", variant: "default" });
      return;
    }
    downloadCSV(bookings, `reservas_${new Date().toISOString().split('T')[0]}.csv`);
    toast({ title: "Exportación exitosa", description: "El archivo CSV ha sido generado", variant: "success" });
  };

  const filteredBookings = bookings.filter((b) =>
    filterStatus === "all" ? true : b.status === filterStatus
  );
  const defaultFrontDeskQueueBookingIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(frontDeskBoard?.arrivals_blocked ?? []),
            ...(frontDeskBoard?.departures_today ?? []),
            ...(frontDeskBoard?.arrivals_ready ?? []),
            ...(frontDeskBoard?.in_house ?? []),
          ].map((entry) => entry.booking_id),
        ),
      ),
    [frontDeskBoard],
  );
  const workspaceCounts = useMemo(
    () => ({
      shift: defaultFrontDeskQueueBookingIds.length,
      arrivals:
        (frontDeskBoard?.arrivals_ready.length ?? 0) +
        (frontDeskBoard?.arrivals_blocked.length ?? 0),
      "in-house": frontDeskBoard?.in_house.length ?? 0,
      departures: frontDeskBoard?.departures_today.length ?? 0,
      reservations: bookings.length,
    }),
    [bookings.length, defaultFrontDeskQueueBookingIds.length, frontDeskBoard],
  );
  const cockpitQueueItems = useMemo(
    () =>
      buildCockpitQueue({
        actionQueue: frontDeskBoard?.action_queue ?? [],
        readyArrivals: frontDeskBoard?.arrivals_ready ?? [],
        blockedArrivals: frontDeskBoard?.arrivals_blocked ?? [],
        departures: frontDeskBoard?.departures_today ?? [],
        inHouse: frontDeskBoard?.in_house ?? [],
      }),
    [frontDeskBoard],
  );
  const queueLaneIds = useMemo(
    () =>
      buildLaneIdSets(
        frontDeskBoard?.arrivals_ready ?? [],
        frontDeskBoard?.arrivals_blocked ?? [],
        frontDeskBoard?.departures_today ?? [],
        frontDeskBoard?.in_house ?? [],
      ),
    [frontDeskBoard],
  );
  const filterQueueByLane = (queueFilter: "arrivals" | "in-house" | "departures") =>
    filterCockpitQueue({
      queue: cockpitQueueItems,
      searchQuery: "",
      queueFilter,
      laneIds: queueLaneIds,
    });
  const openBookingById = (bookingId: string, queueBookingIds?: string[]) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    detailsReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const normalizedQueue = Array.from(
      new Set((queueBookingIds ?? []).filter((id) => id && id !== "")),
    );
    setFrontDeskQueueBookingIds(
      normalizedQueue.length > 0 ? normalizedQueue : defaultFrontDeskQueueBookingIds,
    );
    setSelectedBooking(booking);
    trackReceptionEvent("open_case");
    trackReceptionEvent("review_case");
    if (isDesktop && workspaceView === "shift") {
      setGuidedFocusStep(null);
      setIsDetailsOpen(false);
      return;
    }
    setIsDetailsOpen(true);
  };
  const handleViewChange = (view: ReceptionWorkspaceView) => {
    setWorkspaceView(view);
    if (view !== "shift") {
      setSelectedBooking(null);
      setGuidedFocusStep(null);
      setIsDetailsOpen(false);
      setFrontDeskQueueBookingIds([]);
    }
  };
  const closeSelectedCase = () => {
    setSelectedBooking(null);
    setGuidedFocusStep(null);
    setFrontDeskQueueBookingIds([]);
  };
  const openWalkIn = () => {
    setFrontDeskQueueBookingIds([]);
    setIsWalkInOpen(true);
    trackReceptionEvent("open_walk_in");
  };
  const openReceptionGuideStep = (stepId: string) => {
    const receptionStep = stepId as ReceptionGuideStepId;
    setGuidedFocusStep(receptionStep);
    if (receptionStep === "open-case") {
      setWorkspaceView("shift");
      document.getElementById("front-desk-board")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const selectedMatchesStep =
      selectedBooking &&
      (receptionStep === "review-case" ||
        (receptionStep === "check-in" && selectedBooking.status === "Confirmed") ||
        (["payment", "checkout"].includes(receptionStep) &&
          selectedBooking.status === "CheckedIn"));
    const targetEntry =
      receptionStep === "check-in"
        ? frontDeskBoard?.arrivals_ready?.[0] ?? frontDeskBoard?.arrivals_blocked?.[0]
        : receptionStep === "payment" || receptionStep === "checkout"
          ? frontDeskBoard?.departures_today?.[0] ?? frontDeskBoard?.in_house?.[0]
          : frontDeskBoard?.arrivals_blocked?.[0] ??
            frontDeskBoard?.arrivals_ready?.[0] ??
            frontDeskBoard?.departures_today?.[0] ??
            frontDeskBoard?.in_house?.[0];
    const targetBooking = selectedMatchesStep
      ? selectedBooking
      : bookings.find((item) => item.id === targetEntry?.booking_id);

    if (targetBooking) {
      openBookingById(targetBooking.id, defaultFrontDeskQueueBookingIds);
      return;
    }

    toast({
      title: "No hay un caso disponible para este paso",
      description: "Usá la cola del turno o creá una reserva para continuar el recorrido.",
      variant: "default",
    });
    setWorkspaceView("shift");
    document.getElementById("front-desk-board")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const summary = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((booking) => booking.status === "Confirmed").length,
    checkedIn: bookings.filter((booking) => booking.status === "CheckedIn").length,
    checkedOut: bookings.filter((booking) => booking.status === "CheckedOut").length,
    revenue: bookings
      .filter((booking) => booking.status !== "Cancelled" && booking.status !== "NoShow")
      .reduce((sum, booking) => sum + booking.total_price_cents, 0),
  }), [bookings]);
  const guideState = getReceptionGuideState(selectedBooking?.status);
  const activeGuideStep = guideState.steps.find((step) => step.active);

  const handleStatusUpdate = async (
    id: string,
    status: Booking["status"],
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => {
    try {
      const updatedBooking = await updateBooking(id, { status, front_desk: frontDesk });
      setSelectedBooking((current) => current?.id === id ? updatedBooking : current);
      toast({
        title: "Reserva actualizada",
        description:
          status === "CheckedIn"
            ? "Check-in registrado correctamente."
            : status === "CheckedOut"
              ? "Check-out registrado correctamente."
              : status === "Cancelled"
                ? "Reserva cancelada."
                : status === "NoShow"
                  ? "No-show registrado. La habitacion volvio a disponibilidad."
                : "Estado actualizado.",
        variant: "success",
      });
    } catch (error: unknown) {
      toast({
        title: "No se pudo actualizar",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge variant="info" className="gap-1"><Clock className="w-3 h-3" /> Confirmada</Badge>;
      case "CheckedIn":
        return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Check-in</Badge>;
      case "CheckedOut":
        return <Badge variant="neutral" className="gap-1"><CheckCircle className="w-3 h-3" /> Finalizada</Badge>;
      case "Cancelled":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Cancelada</Badge>;
      case "NoShow":
        return <Badge variant="warning" className="gap-1"><XCircle className="w-3 h-3" /> No-show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const columns: Column<Booking>[] = [
    {
      header: "Huésped",
      cell: (item) => (
        <div>
          <div className="font-bold text-foreground">{item.guest_name}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">ID: {item.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      header: "Habitación",
      accessorKey: "room_id",
      cell: (item) => <Badge variant="outline" className="font-mono">Room {item.room_id.slice(0, 4)}</Badge>
    },
    {
      header: "Check-in",
      accessorKey: "check_in",
    },
    {
      header: "Check-out",
      accessorKey: "check_out",
    },
    {
      header: "Total",
      cell: (item) => <span className="font-mono font-bold text-foreground">${(item.total_price_cents / 100).toLocaleString()}</span>,
    },
    {
      header: "Estado",
      cell: (item) => getStatusBadge(item.status),
    },
    {
      header: "Acciones",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              setFrontDeskQueueBookingIds([]);
              setSelectedBooking(item);
              setIsDetailsOpen(true);
            }}
          >
            Gestionar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setFrontDeskQueueBookingIds([]);
                setSelectedBooking(item);
                setIsEditOpen(true);
              }}>
                Editar reserva
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setFrontDeskQueueBookingIds([]);
                setSelectedBooking(item);
                setIsDetailsOpen(true);
              }}>
                Abrir centro operativo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-[120px]",
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex min-h-10 items-center gap-1.5 lg:hidden" aria-label="Barra de recepción móvil">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-lg font-black tracking-tight text-foreground">Recepción</h1>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 shrink-0 rounded-lg"
                  aria-label="Ayuda sobre recepción"
                  title="Ayuda sobre recepción"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 text-sm">
                Priorizá Nueva Reserva para iniciar una operación. Las colas de llegadas,
                estadías y salidas están organizadas en las vistas operativas.
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 shrink-0 rounded-lg"
              aria-label="Más acciones de recepción"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGuidedModeEnabled(!guidedModeEnabled)}>
              {guidedModeEnabled ? "Salir del modo guiado" : "Iniciar guía"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="min-h-11 shrink-0 rounded-lg bg-primary px-2.5 text-primary-foreground shadow-lg hover:bg-primary/90"
          onClick={openWalkIn}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Nueva reserva
        </Button>
      </div>

      <PageHeader
        title="Recepción"
        className="hidden gap-2 sm:gap-4 lg:flex"
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-xl" aria-label="Ayuda sobre recepción" title="Ayuda sobre recepción">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 text-sm">Priorizá Nueva Reserva para iniciar una operación. Las colas de llegadas, estadías y salidas están organizadas en las vistas operativas.</PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="hidden h-10 rounded-xl border-border sm:inline-flex sm:w-auto"
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button
              size="sm"
              className="h-10 flex-1 rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 sm:w-auto"
              onClick={openWalkIn}
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Reserva
            </Button>
            <Button
              variant={guidedModeEnabled ? "secondary" : "outline"}
              size="sm"
              className="hidden h-10 rounded-xl sm:inline-flex sm:w-auto"
              onClick={() => setGuidedModeEnabled(!guidedModeEnabled)}
            >
              {guidedModeEnabled ? "Salir del modo guiado" : "Iniciar guía"}
            </Button>
          </>
        }
      />
      <p className="hidden text-sm font-medium text-muted-foreground sm:block">
        Trabajo del turno: llegadas, bloqueos, cobros y seguimiento de reservas desde una sola vista.
      </p>

      {guidedModeEnabled ? (
        <CompactGuideAssistant
          title={guideState.summary.title}
          description={guideState.summary.description}
          completed={guideState.summary.completed}
          total={guideState.summary.total}
          steps={guideState.steps}
          ctaLabel="Continuar"
          onCta={activeGuideStep ? () => openReceptionGuideStep(activeGuideStep.id) : undefined}
          onReset={resetReceptionGuide}
          onStepSelect={openReceptionGuideStep}
        />
      ) : null}

      <ReceptionWorkspace
        view={workspaceView}
        onViewChange={handleViewChange}
        counts={workspaceCounts}
        shiftView={
          isDesktop ? (
            <ReceptionShiftView
              items={cockpitQueueItems}
              selectedBooking={selectedBooking}
              loading={frontDeskLoading}
              error={frontDeskError}
              onRetry={() => void refetchFrontDeskBoard()}
              onOpenCase={openBookingById}
              onPrepareCheckIn={(bookingId) => {
                setGuidedFocusStep("check-in");
                openBookingById(bookingId);
              }}
              onCloseCase={closeSelectedCase}
              queueBookingIds={frontDeskQueueBookingIds}
              onOpenQueuedBooking={(bookingId) => {
                openBookingById(bookingId, frontDeskQueueBookingIds);
              }}
              guidedFocusStep={guidedFocusStep}
              onUpdateStatus={handleStatusUpdate}
              onEditBooking={() => setIsEditOpen(true)}
              onRefreshBooking={() => refreshBookingsView()}
            />
          ) : (
            <Suspense
              fallback={
                <section className="motion-refresh rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-sm font-semibold text-muted-foreground">Cargando board operativo...</p>
                </section>
              }
            >
              <div id="front-desk-board" key={frontDeskQueryKey} className="motion-refresh">
                <FrontDeskBoardPanel
                  board={frontDeskBoard}
                  loading={frontDeskLoading}
                  boardDate={boardDate}
                  onBoardDateChange={setBoardDate}
                  onOpenBooking={openBookingById}
                  onPrepareCheckIn={openBookingById}
                />
              </div>
            </Suspense>
          )
        }
        arrivalsView={
          <ReceptionQueueList
            items={filterQueueByLane("arrivals")}
            loading={frontDeskLoading}
            error={frontDeskError}
            emptyMessage="No hay llegadas pendientes"
            onRetry={() => void refetchFrontDeskBoard()}
            onOpen={openBookingById}
            onPrepareCheckIn={openBookingById}
            ariaLabel="Llegadas del día"
          />
        }
        inHouseView={
          <ReceptionQueueList
            items={filterQueueByLane("in-house")}
            loading={frontDeskLoading}
            error={frontDeskError}
            emptyMessage="No hay estadías activas"
            onRetry={() => void refetchFrontDeskBoard()}
            onOpen={openBookingById}
            onPrepareCheckIn={openBookingById}
            ariaLabel="En casa"
          />
        }
        departuresView={
          <ReceptionQueueList
            items={filterQueueByLane("departures")}
            loading={frontDeskLoading}
            error={frontDeskError}
            emptyMessage="No hay salidas pendientes"
            onRetry={() => void refetchFrontDeskBoard()}
            onOpen={openBookingById}
            onPrepareCheckIn={openBookingById}
            ariaLabel="Salidas del día"
          />
        }
        reservationsView={
          <>
            <section className="stagger-list grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Reservas totales
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{summary.total}</p>
                <p className="mt-2 text-sm text-muted-foreground">base operativa actual</p>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Confirmadas
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-primary">{summary.confirmed}</p>
                <p className="mt-2 text-sm text-primary">listas para check-in</p>
              </div>
              <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  En el hotel
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-primary">{summary.checkedIn}</p>
                <p className="mt-2 text-sm text-primary">estadia activa</p>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  Revenue bruto
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
                  ${(summary.revenue / 100).toLocaleString("es-AR")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{summary.checkedOut} salidas completadas</p>
              </div>
            </section>

            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-10 rounded-xl border-border",
                      filterStatus !== "all" && "border-primary/20 bg-primary/10 text-primary",
                    )}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {filterStatus === "all" ? "Filtros" : `Estado: ${filterStatus}`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card">
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>Todos los estados</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("Confirmed")}>Confirmadas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("CheckedIn")}>En el Hotel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("CheckedOut")}>Finalizadas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("Cancelled")}>Canceladas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterStatus("NoShow")}>No-show</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DataTable
              columns={columns}
              data={filteredBookings}
              isLoading={loading}
              error={bookingLoadError}
              onRetry={() => {
                void refetchBookings();
              }}
              searchable
              searchPlaceholder="Buscar por huésped o ID..."
            />
          </>
        }
      />

      <Suspense fallback={null}>
        <WalkInBookingSheet
          isOpen={isWalkInOpen}
          onClose={() => setIsWalkInOpen(false)}
          onCreated={async () => {
            await refreshBookingsView();
            setFrontDeskQueueBookingIds([]);
            closeSelectedCase();
          }}
        />
      </Suspense>

      {selectedBooking && (
        <Suspense fallback={null}>
          <>
            <BookingEditDrawer
              booking={selectedBooking}
              isOpen={isEditOpen}
              onClose={() => {
                setIsEditOpen(false);
                setSelectedBooking(null);
                setFrontDeskQueueBookingIds([]);
              }}
              onSuccess={async () => {
                await refreshBookingsView();
              }}
              onViewDetails={() => setIsDetailsOpen(true)}
            />
            <BookingDetailsSheet
              booking={selectedBooking}
              isOpen={isDetailsOpen}
              onUpdateStatus={handleStatusUpdate}
              onEditBooking={() => {
                setIsDetailsOpen(false);
                setIsEditOpen(true);
              }}
              onRefreshBooking={async () => {
                await refreshBookingsView();
              }}
              guidedFocusStep={guidedFocusStep}
              queueBookingIds={frontDeskQueueBookingIds}
              onOpenQueuedBooking={(bookingId) => {
                openBookingById(bookingId, frontDeskQueueBookingIds);
              }}
              onClose={() => {
                setIsDetailsOpen(false);
                setSelectedBooking(null);
                setFrontDeskQueueBookingIds([]);
                setGuidedFocusStep(null);
                const target = detailsReturnRef.current;
                detailsReturnRef.current = null;
                if (target) requestAnimationFrame(() => target.focus());
              }}
              onCheckInComplete={() => {
                setIsDetailsOpen(false);
                setSelectedBooking(null);
                setFrontDeskQueueBookingIds([]);
                setGuidedFocusStep(null);
                const target = detailsReturnRef.current;
                detailsReturnRef.current = null;
                if (target) requestAnimationFrame(() => target.focus());
              }}
            />
          </>
        </Suspense>
      )}
    </div>
  );
};

export default BookingsPage;
