import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHomeView, {
  type AutomationInsight,
  type RevenueCockpitPriority,
} from "@/features/dashboard/components/DashboardHomeView";
import {
  getDashboardKpis,
  getOccupancyReport,
  getRevenueReport,
  type DashboardKpis,
  type OccupancyReportItem,
  type RevenueReportItem,
} from "@/features/dashboard/services/analyticsService";
import { closeCash, getCashBalance, type CashBalance } from "@/features/dashboard/services/billingService";
import type { CloseCashRequest } from "@/features/dashboard/services/billingService";
import CashShiftCloseSheet from "@/features/dashboard/components/CashShiftCloseSheet";
import { getFeatureFlags, type TenantFeatureFlags } from "@/features/dashboard/services/hotelService";
import { getDirtyRooms } from "@/features/housekeeping/services/housekeepingService";
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
  const [isCashCloseOpen, setIsCashCloseOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hasTrackedLoadFailureRef = useRef(false);
  const hasTrackedRevenueCockpitViewRef = useRef(false);
  const {
    data: featureFlagsData,
  } = useResourceQuery<TenantFeatureFlags>({
    queryKey: "feature-flags:current",
    queryFn: getFeatureFlags,
    staleTimeMs: 30_000,
    retry: false,
  });

  const {
    data: dirtyRoomsData,
  } = useResourceQuery({
    queryKey: "automation:dirty-rooms",
    queryFn: getDirtyRooms,
    staleTimeMs: 15_000,
    enabled: featureFlagsData?.automation_alerts_enabled ?? false,
  });

  const {
    data: dashboardData,
    isLoading: loading,
    error: dashboardError,
    refetch: refetchDashboard,
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
  const featureFlags = featureFlagsData ?? null;
  const dirtyRoomsCount = dirtyRoomsData?.length ?? 0;
  const loadError = dashboardError ? "No se pudo cargar el dashboard. Reintentá." : null;

  const dailyPriorities = useMemo<RevenueCockpitPriority[]>(() => {
    if (!kpis) return [];
    const priorities: RevenueCockpitPriority[] = [];

    if (kpis.occupancy_rate < 65) {
      priorities.push({
        id: "occupancy-recovery",
        title: "Ocupación baja para hoy",
        description: "Publicar oferta de última hora y revisar disponibilidad abierta.",
        actionLabel: "Ajustar inventario",
        route: "/rooms",
        severity: "high",
      });
    }

    if (kpis.arrivals_today.length > 0) {
      priorities.push({
        id: "arrival-readiness",
        title: "Pre-checkin y asignación pendiente",
        description: "Priorizar llegadas del día para reducir fricción en recepción.",
        actionLabel: "Ver reservas",
        route: "/bookings",
        severity: "medium",
      });
    }

    if (kpis.rev_par_cents > 0 && kpis.adr_cents > 0 && kpis.rev_par_cents < kpis.adr_cents * 0.6) {
      priorities.push({
        id: "revpar-gap",
        title: "RevPAR por debajo del potencial ADR",
        description: "Impulsar upsell y revisar tarifas por segmento para cerrar brecha.",
        actionLabel: "Abrir tendencias",
        route: "/reports",
        severity: "high",
      });
    }

    if (kpis.departures_today.length > 0) {
      priorities.push({
        id: "checkout-turnover",
        title: "Ventana de rotación por check-outs",
        description: "Coordinar limpieza y liberar habitaciones para venta temprana.",
        actionLabel: "Ir a limpieza",
        route: "/housekeeping",
        severity: "medium",
      });
    }

    if (priorities.length === 0) {
      priorities.push({
        id: "steady-operations",
        title: "Operación estable",
        description: "Sin alertas críticas. Enfocar al equipo en upsell y experiencia huésped.",
        actionLabel: "Ver calendario",
        route: "/calendar",
        severity: "low",
      });
    }

    return priorities.slice(0, 3);
  }, [kpis]);

  const automationInsights = useMemo<AutomationInsight[]>(() => {
    if (!featureFlags || !kpis || !featureFlags.automation_alerts_enabled) return [];

    const insights: AutomationInsight[] = [];

    if (dirtyRoomsCount >= 3) {
      insights.push({
        id: "housekeeping-sla",
        title: "SLA housekeeping comprometido",
        description: `${dirtyRoomsCount} habitaciones sucias requieren atención para evitar pérdida de inventario.`,
        actionLabel: "Ir a limpieza",
        route: "/housekeeping",
        severity: "high",
      });
    }

    if (featureFlags.pricing_assistant_enabled && kpis.occupancy_rate < 65) {
      insights.push({
        id: "pricing-assistant-low-occ",
        title: "Pricing asistido: demanda baja",
        description: "Recomendación: ajustar tarifa base (-8%) para recuperar ocupación de corto plazo.",
        actionLabel: "Revisar tendencias",
        route: "/reports",
        severity: "medium",
      });
    }

    if (kpis.departures_today.length > kpis.arrivals_today.length + 2) {
      insights.push({
        id: "inventory-gap",
        title: "Excepción de rotación diaria",
        description: "Más salidas que llegadas en la jornada. Revisar pipeline comercial y overbooking.",
        actionLabel: "Ver reservas",
        route: "/bookings",
        severity: "medium",
      });
    }

    if (insights.length === 0 && featureFlags.pricing_assistant_enabled) {
      insights.push({
        id: "pricing-health",
        title: "Pricing asistido estable",
        description: "Sin alertas críticas. Mantener monitoreo de ADR y RevPAR por segmento.",
        actionLabel: "Abrir tendencias",
        route: "/reports",
        severity: "low",
      });
    }

    return insights.slice(0, 3);
  }, [dirtyRoomsCount, featureFlags, kpis]);

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

  useEffect(() => {
    if (!kpis || dashboardError || hasTrackedRevenueCockpitViewRef.current) {
      return;
    }
    hasTrackedRevenueCockpitViewRef.current = true;
    trackUiEvent("revenue_cockpit_viewed", {
      occupancy_rate: kpis.occupancy_rate,
      adr_cents: kpis.adr_cents,
      rev_par_cents: kpis.rev_par_cents,
      priorities_count: dailyPriorities.length,
    });
  }, [dailyPriorities.length, dashboardError, kpis]);

  const handleCloseCash = useCallback(async (request: CloseCashRequest) => {
    setIsClosing(true);
    try {
      const closure = await closeCash(request);
      trackUiEvent("close_cash_success", {
        total_amount_cents: balance?.total_amount_cents ?? 0,
        cash_difference_cents: closure.cash_difference_cents,
      });
      toast({ title: "Turno cerrado", description: "Arqueo y handoff registrados correctamente", variant: "success" });
      await refetchDashboard();
      return true;
    } catch (error) {
      trackUiEvent("close_cash_failure", {
        message: getErrorMessage(error, "No se pudo cerrar la caja"),
      });
      toast({ title: "Error", description: "No se pudo cerrar la caja", variant: "error" });
      return false;
    } finally {
      setIsClosing(false);
    }
  }, [balance?.total_amount_cents, refetchDashboard, toast]);

  const handleRetryDashboard = useCallback(() => {
    trackUiEvent("dashboard_retry_clicked");
    void refetchDashboard();
  }, [refetchDashboard]);

  const handleDrawerSuccess = useCallback(async () => {
    await refetchDashboard();
  }, [refetchDashboard]);

  const handleAlertSelect = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const handleRevenueCtaClick = useCallback(
    (priority: RevenueCockpitPriority) => {
      trackUiEvent("revenue_cockpit_cta_clicked", {
        cta_id: priority.id,
        severity: priority.severity,
        destination: priority.route,
      });
      navigate(priority.route);
    },
    [navigate],
  );

  const handleAutomationAction = useCallback(
    (insight: AutomationInsight) => {
      trackUiEvent("automation_alert_clicked", {
        alert_id: insight.id,
        severity: insight.severity,
        destination: insight.route,
      });
      navigate(insight.route);
    },
    [navigate],
  );

  return (
    <>
      <DashboardHomeView
      loading={loading}
      loadError={loadError}
      isClosing={isClosing}
      kpis={kpis}
      balance={balance}
      revenueData={revenueData}
      occupancyData={occupancyData}
      dailyPriorities={dailyPriorities}
      featureFlags={featureFlags}
      automationInsights={automationInsights}
      isDrawerOpen={isDrawerOpen}
      selectedBookingId={selectedBookingId}
      onRetry={handleRetryDashboard}
      onNavigateBookings={() => navigate("/bookings")}
      onCloseCash={() => setIsCashCloseOpen(true)}
      onRevenueCtaClick={handleRevenueCtaClick}
      onAutomationAction={handleAutomationAction}
      onAlertSelect={handleAlertSelect}
      onDrawerClose={handleDrawerClose}
      onDrawerSuccess={handleDrawerSuccess}
      />
      <CashShiftCloseSheet
        open={isCashCloseOpen}
        expectedCashAmountCents={balance?.cash_amount_cents ?? 0}
        paymentCount={balance?.payment_count ?? 0}
        isSubmitting={isClosing}
        onOpenChange={setIsCashCloseOpen}
        onSubmit={handleCloseCash}
      />
    </>
  );
};

export default DashboardHome;
