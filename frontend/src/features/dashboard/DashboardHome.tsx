import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import BookingEditDrawer from "@/features/bookings/components/BookingEditDrawer";
import { getErrorMessage } from "@/api/errors";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { trackUiEvent } from "@/lib/telemetry";
import DashboardAlertsPanel from "@/features/dashboard/components/DashboardAlertsPanel";
import DashboardCashClosureCard from "@/features/dashboard/components/DashboardCashClosureCard";
import DashboardChartsSection from "@/features/dashboard/components/DashboardChartsSection";
import DashboardKpiGrid from "@/features/dashboard/components/DashboardKpiGrid";
import DashboardRecentBookingsCard from "@/features/dashboard/components/DashboardRecentBookingsCard";
import {
  getDashboardKpis,
  getOccupancyReport,
  getRevenueReport,
  type DashboardKpis,
  type OccupancyReportItem,
  type RevenueReportItem,
} from "./services/analyticsService";
import { closeCash, getCashBalance, type CashBalance } from "./services/billingService";

type DashboardData = {
  kpis: DashboardKpis;
  revenueData: RevenueReportItem[];
  occupancyData: OccupancyReportItem[];
  balance: CashBalance;
};

const DASHBOARD_QUERY_KEY = "dashboard:home";

const DashboardHome = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isClosing, setIsClosing] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hasTrackedLoadFailureRef = useRef(false);

  const {
    data: dashboardData,
    isLoading: loading,
    error: dashboardError,
    refetch: refetchDashboard,
    invalidate: invalidateDashboard,
  } = useResourceQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const [kpis, revenueData, occupancyData, balance] = await Promise.all([
        getDashboardKpis(),
        getRevenueReport(),
        getOccupancyReport(),
        getCashBalance(),
      ]);
      return { kpis, revenueData, occupancyData, balance };
    },
    staleTimeMs: 10_000,
  });

  const kpis = dashboardData?.kpis ?? null;
  const revenueData = dashboardData?.revenueData ?? [];
  const occupancyData = dashboardData?.occupancyData ?? [];
  const balance = dashboardData?.balance ?? null;
  const loadError = dashboardError ? "No se pudo cargar el dashboard. Reintentá." : null;

  useEffect(() => {
    if (dashboardError && !hasTrackedLoadFailureRef.current) {
      hasTrackedLoadFailureRef.current = true;
      trackUiEvent("dashboard_load_failed", {
        message: dashboardError,
      });
      return;
    }

    if (!dashboardError) {
      hasTrackedLoadFailureRef.current = false;
    }
  }, [dashboardError]);

  const handleCloseCash = useCallback(async () => {
    if (!confirm("¿Deseas realizar el cierre de caja ahora? Se reseteará el balance para el próximo turno.")) {
      return;
    }

    setIsClosing(true);
    try {
      await closeCash("Cierre manual desde dashboard");
      trackUiEvent("close_cash_success", {
        total_amount_cents: balance?.total_amount_cents ?? 0,
      });
      toast({ title: "Caja cerrada", description: "El reporte ha sido generado correctamente", variant: "success" });
      invalidateDashboard();
      await refetchDashboard();
    } catch (error: unknown) {
      trackUiEvent("close_cash_failure", {
        message: getErrorMessage(error, "No se pudo cerrar la caja"),
      });
      toast({ title: "Error", description: "No se pudo cerrar la caja", variant: "error" });
    } finally {
      setIsClosing(false);
    }
  }, [balance?.total_amount_cents, invalidateDashboard, refetchDashboard, toast]);

  const handleDrawerSuccess = useCallback(async () => {
    invalidateDashboard();
    await refetchDashboard();
  }, [invalidateDashboard, refetchDashboard]);

  const formattedRevenueData = useMemo(
    () =>
      revenueData.map((item) => ({
        amount: item.amount_cents / 100,
        dateLabel: format(new Date(item.date), "dd/MM"),
      })),
    [revenueData],
  );

  const formattedOccupancyData = useMemo(
    () =>
      occupancyData.map((item) => ({
        rate: item.occupancy_rate,
        dateLabel: format(new Date(item.date), "dd/MM"),
      })),
    [occupancyData],
  );

  return (
    <div className="animate-in space-y-10 fade-in duration-700">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black leading-none tracking-tight text-slate-900 dark:text-slate-100">Vista General</h2>
        <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">Estado operativo del hotel en tiempo real.</p>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg border-rose-200 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40"
            onClick={() => {
              trackUiEvent("dashboard_retry_clicked");
              void refetchDashboard();
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      <DashboardKpiGrid kpis={kpis} loading={loading} />

      <DashboardChartsSection
        loading={loading}
        revenueData={formattedRevenueData}
        occupancyData={formattedOccupancyData}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <DashboardCashClosureCard balance={balance} isClosing={isClosing} onCloseCash={handleCloseCash} />
        </div>

        <div className="lg:col-span-2">
          <DashboardAlertsPanel
            loading={loading}
            kpis={kpis}
            onOpenBooking={(bookingId) => {
              setSelectedBookingId(bookingId);
              setIsDrawerOpen(true);
            }}
          />
        </div>

        <div className="lg:col-span-3">
          <DashboardRecentBookingsCard onViewAll={() => navigate("/bookings")} />
        </div>
      </div>

      <BookingEditDrawer
        booking={null}
        bookingId={selectedBookingId}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
};

export default DashboardHome;
