import { Suspense, lazy, useMemo, useState } from "react";
import {
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Filter,
  Download,
  ArrowRight,
  DoorOpen,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBookings, getFrontDeskBoard, updateBooking } from "./services/bookingService";
import { Booking, BookingFrontDeskData, FrontDeskBoard, FrontDeskBoardEntry } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import { downloadCSV, cn } from "@/lib/utils";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { getErrorMessage } from "@/api/errors";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";
import { useGuidedMode } from "@/features/guided/GuidedModeContext";
import GuideRail from "@/features/guided/components/GuideRail";
import GuideHint from "@/features/guided/components/GuideHint";

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
    refetch: refetchFrontDeskBoard,
  } = useResourceQuery({
    queryKey: frontDeskQueryKey,
    queryFn: () => getFrontDeskBoard(boardDate),
    staleTimeMs: 10_000,
  });

  const refreshBookingsView = async (selectedId?: string) => {
    invalidateResource(bookingQueryKey);
    invalidateResource(frontDeskQueryKey);
    await refetchBookings();
    await refetchFrontDeskBoard();

    if (!selectedId) return;
    const refreshedBookings = await getBookings();
    const refreshedSelected = refreshedBookings.find((item) => item.id === selectedId) ?? null;
    setSelectedBooking(refreshedSelected);
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
  const openBookingById = (bookingId: string, queueBookingIds?: string[]) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const normalizedQueue = Array.from(
      new Set((queueBookingIds ?? []).filter((id) => id && id !== "")),
    );
    setFrontDeskQueueBookingIds(
      normalizedQueue.length > 0 ? normalizedQueue : defaultFrontDeskQueueBookingIds,
    );
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
    trackReceptionEvent("open_case");
    trackReceptionEvent("review_case");
  };
  const openWalkIn = () => {
    setFrontDeskQueueBookingIds([]);
    setIsWalkInOpen(true);
    trackReceptionEvent("open_walk_in");
  };
  const operationalTasks = useMemo(
    () => {
      const board = frontDeskBoard as FrontDeskBoard | undefined;
      const taskCards: Array<{
        key: string;
        title: string;
        helper: string;
        count: number;
        tone: string;
        actionLabel: string;
        icon: typeof DoorOpen;
        entry?: FrontDeskBoardEntry;
        onAction: () => void;
      }> = [];

      const firstReady = board?.arrivals_ready?.[0];
      const firstBlocked = board?.arrivals_blocked?.[0];
      const firstDeparture = board?.departures_today?.[0];

      taskCards.push({
        key: "arrivals-ready",
        title: "Check-ins listos",
        helper: firstReady
          ? `${firstReady.guest_name} ya puede pasar por recepción.`
          : "No hay llegadas listas para iniciar ahora.",
        count: board?.arrivals_ready?.length ?? 0,
        tone: "border-primary/20 bg-primary/10",
        actionLabel: firstReady ? "Abrir llegada" : "Nueva reserva",
        icon: DoorOpen,
        entry: firstReady,
        onAction: () => {
          if (firstReady) {
            openBookingById(firstReady.booking_id, defaultFrontDeskQueueBookingIds);
            return;
          }
          openWalkIn();
        },
      });

      taskCards.push({
        key: "blocked-arrivals",
        title: "Casos bloqueados",
        helper: firstBlocked
          ? `${firstBlocked.guest_name} necesita resolución operativa antes del check-in.`
          : "No hay bloqueos activos en recepción.",
        count: board?.arrivals_blocked?.length ?? 0,
        tone: "border-amber-500/20 bg-amber-500/10",
        actionLabel: firstBlocked ? "Resolver caso" : "Ver board",
        icon: ShieldAlert,
        entry: firstBlocked,
        onAction: () => {
          if (firstBlocked) {
            openBookingById(firstBlocked.booking_id, defaultFrontDeskQueueBookingIds);
            return;
          }
          void refetchFrontDeskBoard();
        },
      });

      taskCards.push({
        key: "departures",
        title: "Cobros y salidas",
        helper: firstDeparture
          ? `${firstDeparture.guest_name} debería cerrar checkout y cuenta hoy.`
          : "No hay salidas pendientes en la fecha operativa.",
        count: board?.departures_today?.length ?? 0,
        tone: "border-secondary/20 bg-secondary/10",
        actionLabel: firstDeparture ? "Preparar checkout" : "Exportar reservas",
        icon: CreditCard,
        entry: firstDeparture,
        onAction: () => {
          if (firstDeparture) {
            openBookingById(firstDeparture.booking_id, defaultFrontDeskQueueBookingIds);
            return;
          }
          handleExport();
        },
      });

      return taskCards;
    },
    [
      defaultFrontDeskQueueBookingIds,
      frontDeskBoard,
      refetchFrontDeskBoard,
      handleExport,
    ],
  );
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
  const guideCta = useMemo(() => {
    const firstReady = frontDeskBoard?.arrivals_ready?.[0];
    const firstBlocked = frontDeskBoard?.arrivals_blocked?.[0];
    if (!guideState.steps[0]?.done) {
      if (firstReady) {
        return {
          label: "Abrir llegada",
          onClick: () => openBookingById(firstReady.booking_id, defaultFrontDeskQueueBookingIds),
        };
      }
      if (firstBlocked) {
        return {
          label: "Resolver caso",
          onClick: () => openBookingById(firstBlocked.booking_id, defaultFrontDeskQueueBookingIds),
        };
      }
      return {
        label: "Nueva reserva",
        onClick: openWalkIn,
      };
    }
    if (selectedBooking && !guideState.steps[3].done && selectedBooking.status === "CheckedIn") {
      return {
        label: "Volver al caso",
        onClick: () => setIsDetailsOpen(true),
      };
    }
    return null;
  }, [
    defaultFrontDeskQueueBookingIds,
    frontDeskBoard?.arrivals_blocked,
    frontDeskBoard?.arrivals_ready,
    guideState.steps,
    selectedBooking,
  ]);

  const handleStatusUpdate = async (
    id: string,
    status: Booking["status"],
    frontDesk?: Partial<BookingFrontDeskData>,
  ) => {
    try {
      await updateBooking(id, { status, front_desk: frontDesk });
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
      await refreshBookingsView(id);
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
      header: "",
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
    <div className="space-y-6">
      <PageHeader
        title="Recepción"
        description="Trabajo del turno: llegadas, bloqueos, cobros y seguimiento de reservas desde una sola vista."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-10 w-full rounded-xl border-border sm:w-auto",
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

            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full rounded-xl border-border sm:w-auto"
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button
              size="sm"
              className="h-10 w-full rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 sm:w-auto"
              onClick={openWalkIn}
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Reserva
            </Button>
            <Button
              variant={guidedModeEnabled ? "secondary" : "outline"}
              size="sm"
              className="h-10 w-full rounded-xl sm:w-auto"
              onClick={() => setGuidedModeEnabled(!guidedModeEnabled)}
            >
              {guidedModeEnabled ? "Ocultar guía" : "Modo guiado"}
            </Button>
          </>
        }
      />

      {guidedModeEnabled ? (
        <GuideRail
          title={guideState.summary.title}
          description={guideState.summary.description}
          completed={guideState.summary.completed}
          total={guideState.summary.total}
          steps={guideState.steps}
          enabled={guidedModeEnabled}
          onToggle={() => setGuidedModeEnabled(!guidedModeEnabled)}
          onReset={resetReceptionGuide}
          ctaLabel={guideCta?.label}
          onCta={guideCta?.onClick}
        />
      ) : null}

      <section className="stagger-list grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <SectionEyebrow>Lo inmediato del turno</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
            Empezá por estas tres colas
          </h2>
          <p className="mt-2 max-w-[56ch] text-sm text-muted-foreground">
            Primero check-ins listos, después bloqueos y después salidas con cobro. El resto ya
            baja al board completo.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {operationalTasks.map((task) => {
              const TaskIcon = task.icon;
              return (
                <article
                  key={task.key}
                  className={cn(
                    "rounded-3xl border p-5 shadow-sm transition-colors",
                    task.tone,
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                        {task.title}
                      </p>
                      <p className="mt-3 text-3xl font-black tracking-tight text-foreground">
                        {task.count}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-card p-3 shadow-sm">
                      <TaskIcon className="h-5 w-5 text-foreground" />
                    </div>
                  </div>
                  <p className="mt-4 min-h-[2.75rem] text-sm text-muted-foreground">
                    {task.helper}
                  </p>
                  {task.entry ? (
                    <div className="mt-4 rounded-2xl border border-border bg-card/80 px-4 py-3">
                      <p className="text-sm font-black text-foreground">{task.entry.guest_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hab. {task.entry.room_number} · {task.entry.room_type}
                      </p>
                    </div>
                  ) : null}
                  <Button
                    className="mt-4 h-11 w-full rounded-2xl"
                    variant={task.entry ? "default" : "outline"}
                    onClick={task.onAction}
                  >
                    {task.actionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {guidedModeEnabled ? (
            <GuideHint
              title={guideState.summary.title}
              description={guideState.summary.description}
              ctaLabel={guideCta?.label}
              onCta={guideCta?.onClick}
            />
          ) : null}
          <SectionCard>
            <SectionEyebrow>Foco del turno</SectionEyebrow>
            <p className="mt-3 text-xl font-black tracking-tight text-foreground">
              {(frontDeskBoard?.arrivals_blocked?.length ?? 0) > 0
                ? "Destrabar casos antes del check-in"
                : (frontDeskBoard?.departures_today?.length ?? 0) > 0
                  ? "Cerrar checkout y cobros"
                  : "Convertir llegadas en check-ins"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {(frontDeskBoard?.arrivals_blocked?.length ?? 0) > 0
                ? "Hay casos que traban el turno y además afectan habitaciones."
                : (frontDeskBoard?.departures_today?.length ?? 0) > 0
                  ? "Las salidas de hoy son la palanca para liberar caja e inventario."
                  : "Si el turno está limpio, empujá ingresos y seguimiento fino."}
            </p>
          </SectionCard>

          <SectionCard>
            <SectionEyebrow>Siguiente capa</SectionEyebrow>
            <p className="mt-3 text-xl font-black tracking-tight text-foreground">
              Board completo + reservas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Después de resolver lo urgente, bajá al board operativo y desde ahí abrí la reserva o
              la tabla completa según el caso.
            </p>
          </SectionCard>
        </div>
      </section>

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

      <Suspense fallback={null}>
        <WalkInBookingSheet
          isOpen={isWalkInOpen}
          onClose={() => setIsWalkInOpen(false)}
          onCreated={async (booking) => {
            invalidateResource(bookingQueryKey);
            await refreshBookingsView(booking.id);
            setFrontDeskQueueBookingIds([]);
            setSelectedBooking(booking);
            setIsDetailsOpen(true);
            trackReceptionEvent("review_case");
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
                await refreshBookingsView(selectedBooking.id);
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
                await refreshBookingsView(selectedBooking.id);
              }}
              queueBookingIds={frontDeskQueueBookingIds}
              onOpenQueuedBooking={(bookingId) => {
                openBookingById(bookingId, frontDeskQueueBookingIds);
              }}
              onClose={() => {
                setIsDetailsOpen(false);
                setSelectedBooking(null);
                setFrontDeskQueueBookingIds([]);
              }}
            />
          </>
        </Suspense>
      )}
    </div>
  );
};

export default BookingsPage;
