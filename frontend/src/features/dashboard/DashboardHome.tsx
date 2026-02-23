import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeView from "@/features/dashboard/components/DashboardHomeView";
import {
  getDashboardKpis,
  getOccupancyReport,
  getRevenueReport,
  type DashboardKpis,
  type OccupancyReportItem,
  type RevenueReportItem,
} from "@/features/dashboard/services/analyticsService";
import { closeCash, getCashBalance, type CashBalance } from "@/features/dashboard/services/billingService";
import { useToast } from "@/components/ui/toast";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { trackUiEvent } from "@/lib/telemetry";
import { getErrorMessage } from "@/api/errors";

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
    retry: false,
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
    } catch (error) {
      trackUiEvent("close_cash_failure", {
        message: getErrorMessage(error, "No se pudo cerrar la caja"),
      });
      toast({ title: "Error", description: "No se pudo cerrar la caja", variant: "error" });
    } finally {
      setIsClosing(false);
    }
  }, [balance?.total_amount_cents, invalidateDashboard, refetchDashboard, toast]);

  const handleRetryDashboard = useCallback(() => {
    trackUiEvent("dashboard_retry_clicked");
    void refetchDashboard();
  }, [refetchDashboard]);

  const handleDrawerSuccess = useCallback(async () => {
    invalidateDashboard();
    await refetchDashboard();
  }, [invalidateDashboard, refetchDashboard]);

  const handleAlertSelect = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <DashboardHomeView
      loading={loading}
      loadError={loadError}
      isClosing={isClosing}
      kpis={kpis}
      balance={balance}
      revenueData={revenueData}
      occupancyData={occupancyData}
      isDrawerOpen={isDrawerOpen}
      selectedBookingId={selectedBookingId}
      onRetry={handleRetryDashboard}
      onNavigateBookings={() => navigate("/bookings")}
      onCloseCash={() => void handleCloseCash()}
      onAlertSelect={handleAlertSelect}
      onDrawerClose={handleDrawerClose}
      onDrawerSuccess={handleDrawerSuccess}
    />
  );
};

export default DashboardHome;
