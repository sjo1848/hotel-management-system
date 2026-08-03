import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DashboardControlCenter, { type DashboardTab } from "@/features/dashboard/components/DashboardControlCenter";
import DashboardOperationPanel from "@/features/dashboard/components/DashboardOperationPanel";
import DashboardPerformancePanel from "@/features/dashboard/components/DashboardPerformancePanel";
import CashShiftSummary from "@/features/dashboard/components/CashShiftSummary";
import CashShiftCloseSheet from "@/features/dashboard/components/CashShiftCloseSheet";
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
import { getFeatureFlags, type TenantFeatureFlags } from "@/features/dashboard/services/hotelService";
import { getDirtyRooms } from "@/features/housekeeping/services/housekeepingService";
import { useAuth } from "@/features/auth/useAuth";
import { roleHasCapability } from "@/features/auth/capabilities";
import { useToast } from "@/components/ui/toast";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { trackUiEvent } from "@/lib/telemetry";
import { getErrorMessage } from "@/api/errors";
import {
  buildDashboardPriorities,
  getRouteCapability,
  type DashboardPriority,
} from "@/features/dashboard/utils/dashboardPriorities";
import { DEFAULT_REPORT_RANGE, getReportRange, type ReportRange } from "@/features/dashboard/utils/reportRange";

const DashboardHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DashboardTab>("operation");
  const [performanceEnabled, setPerformanceEnabled] = useState(false);
  const [range, setRange] = useState<ReportRange>(DEFAULT_REPORT_RANGE);
  const [isClosing, setIsClosing] = useState(false);
  const [isCashCloseOpen, setIsCashCloseOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasTrackedLoadFailureRef = useRef(false);
  const hasTrackedRevenueCockpitViewRef = useRef(false);

  const featureFlagsQuery = useResourceQuery<TenantFeatureFlags>({
    queryKey: "feature-flags:current",
    queryFn: getFeatureFlags,
    staleTimeMs: 30_000,
    retry: false,
  });

  const dirtyRoomsQuery = useResourceQuery<unknown[]>({
    queryKey: "automation:dirty-rooms",
    queryFn: getDirtyRooms,
    staleTimeMs: 15_000,
    enabled: featureFlagsQuery.data?.automation_alerts_enabled ?? false,
  });

  const kpisQuery = useResourceQuery<DashboardKpis>({
    queryKey: "dashboard:kpis",
    queryFn: getDashboardKpis,
    staleTimeMs: 10_000,
    retry: false,
  });

  const balanceQuery = useResourceQuery<CashBalance>({
    queryKey: "dashboard:cash-balance",
    queryFn: getCashBalance,
    staleTimeMs: 10_000,
    retry: false,
  });

  const { start, end } = getReportRange(range);
  const revenueQuery = useResourceQuery<RevenueReportItem[]>({
    queryKey: `dashboard:revenue:${start}:${end}`,
    queryFn: () => getRevenueReport(start, end),
    staleTimeMs: 30_000,
    retry: false,
    enabled: performanceEnabled,
  });

  const occupancyQuery = useResourceQuery<OccupancyReportItem[]>({
    queryKey: `dashboard:occupancy:${start}:${end}`,
    queryFn: () => getOccupancyReport(start, end),
    staleTimeMs: 30_000,
    retry: false,
    enabled: performanceEnabled,
  });

  const kpis = kpisQuery.data;
  const balance = balanceQuery.data;
  const featureFlags = featureFlagsQuery.data ?? null;
  const dirtyRoomsCount =
    dirtyRoomsQuery.error || dirtyRoomsQuery.isLoading
      ? null
      : (dirtyRoomsQuery.data?.length ?? 0);

  const priorities = useMemo(
    () =>
      buildDashboardPriorities({
        kpis,
        balance,
        dirtyRoomsCount,
        featureFlags,
      }),
    [balance, dirtyRoomsCount, featureFlags, kpis],
  );

  const refreshActiveQueries = useCallback(async () => {
    const activeRefreshes = [
      kpisQuery.refetch(),
      balanceQuery.refetch(),
      featureFlagsQuery.refetch(),
      ...(featureFlagsQuery.data?.automation_alerts_enabled
        ? [dirtyRoomsQuery.refetch()]
        : []),
    ];
    if (performanceEnabled) {
      await Promise.all([
        ...activeRefreshes,
        revenueQuery.refetch(),
        occupancyQuery.refetch(),
      ]);
      return;
    }
    await Promise.all(activeRefreshes);
  }, [
    balanceQuery,
    dirtyRoomsQuery,
    featureFlagsQuery,
    featureFlagsQuery.data?.automation_alerts_enabled,
    kpisQuery,
    occupancyQuery,
    performanceEnabled,
    range,
    revenueQuery,
  ]);

  useEffect(() => {
    if (kpis && !kpisQuery.isLoading) {
      setLastUpdated(new Date());
    }
  }, [kpis, kpisQuery.isLoading]);

  useEffect(() => {
    if (kpisQuery.error && !hasTrackedLoadFailureRef.current) {
      hasTrackedLoadFailureRef.current = true;
      trackUiEvent("dashboard_load_failed", {
        message: kpisQuery.error,
      });
      return;
    }

    if (!kpisQuery.error) {
      hasTrackedLoadFailureRef.current = false;
    }
  }, [kpisQuery.error]);

  useEffect(() => {
    if (!kpis || kpisQuery.error || hasTrackedRevenueCockpitViewRef.current) {
      return;
    }
    hasTrackedRevenueCockpitViewRef.current = true;
    trackUiEvent("revenue_cockpit_viewed", {
      occupancy_rate: kpis.occupancy_rate,
      adr_cents: kpis.adr_cents,
      rev_par_cents: kpis.rev_par_cents,
      priorities_count: priorities.length,
    });
  }, [kpis, kpisQuery.error, priorities.length]);

  const hasCapability = useCallback(
    (route?: string) => {
      const capability = getRouteCapability(route);
      return capability ? roleHasCapability(user?.role, capability) : false;
    },
    [user?.role],
  );

  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === "performance") {
      setPerformanceEnabled(true);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshActiveQueries();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshActiveQueries]);

  const handleCloseCash = useCallback(
    async (request: CloseCashRequest) => {
      setIsClosing(true);
      try {
        const closure = await closeCash(request);
        trackUiEvent("close_cash_success", {
          total_amount_cents: balance?.total_amount_cents ?? 0,
          cash_difference_cents: closure.cash_difference_cents,
        });
        toast({ title: "Turno cerrado", description: "Arqueo y handoff registrados correctamente", variant: "success" });
        await refreshActiveQueries();
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
    },
    [balance?.total_amount_cents, refreshActiveQueries, toast],
  );

  const handleRetryDashboard = useCallback(() => {
    trackUiEvent("dashboard_retry_clicked");
    void refreshActiveQueries();
  }, [refreshActiveQueries]);

  const handleRetryCash = useCallback(() => {
    void balanceQuery.refetch();
  }, [balanceQuery]);

  const handlePriorityAction = useCallback(
    (priority: DashboardPriority) => {
      if (priority.source === "automation") {
        trackUiEvent("automation_alert_clicked", {
          alert_id: priority.id,
          severity: priority.severity,
          destination: priority.route,
        });
      } else {
        trackUiEvent("revenue_cockpit_cta_clicked", {
          cta_id: priority.id,
          severity: priority.severity,
          destination: priority.route,
        });
      }
      if (priority.route) {
        navigate(priority.route);
      }
    },
    [navigate],
  );

  const handleNavigateCalendar = useCallback(() => {
    navigate("/calendar");
  }, [navigate]);

  const openCashClose = useCallback(() => setIsCashCloseOpen(true), []);
  const handleRangeChange = useCallback((nextRange: ReportRange) => {
    setRange(nextRange);
  }, []);

  const operationPanel = (
    <DashboardOperationPanel
      priorities={priorities}
      prioritiesLoading={kpisQuery.isLoading}
      hasCapability={hasCapability}
      onPriorityAction={handlePriorityAction}
      onNavigateCalendar={handleNavigateCalendar}
      kpis={kpis}
      kpisLoading={kpisQuery.isLoading}
      featureFlags={featureFlags}
      balance={balance}
      balanceLoading={balanceQuery.isLoading}
      balanceError={balanceQuery.error}
      isClosing={isClosing}
      canCloseCash={roleHasCapability(user?.role, "billing.close_cash.write")}
      cashCloseOpen={isCashCloseOpen}
      onOpenCashClose={openCashClose}
      onRetryCash={handleRetryCash}
    />
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      {kpisQuery.error ? (
        <div className="mx-auto w-full max-w-7xl">
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="min-w-0">
                <h1 className="text-lg font-black text-foreground">No se pudo cargar el pulso operativo</h1>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  Verificá la conexión e intentá nuevamente. La caja del turno sigue disponible.
                </p>
                <Button
                  type="button"
                  className="mt-4 h-11 rounded-xl"
                  onClick={handleRetryDashboard}
                >
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
          {!balanceQuery.isLoading && balance ? (
            <div className="mt-5">
              <CashShiftSummary
                balance={balance}
                loading={false}
                error={null}
                isClosing={isClosing}
                cashCloseOpen={isCashCloseOpen}
                canCloseCash={roleHasCapability(user?.role, "billing.close_cash.write")}
                onOpenCashClose={openCashClose}
                onRetry={handleRetryCash}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <DashboardControlCenter
          activeTab={activeTab}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          onTabChange={handleTabChange}
          onRefresh={handleRefresh}
          operationPanel={operationPanel}
          performancePanel={
            <DashboardPerformancePanel
              enabled={performanceEnabled}
              kpis={kpis}
              range={range}
              onRangeChange={handleRangeChange}
              revenueQuery={revenueQuery}
              occupancyQuery={occupancyQuery}
              hasCapability={hasCapability}
              onOpenReports={() => navigate("/reports")}
            />
          }
        />
      )}
      <CashShiftCloseSheet
        open={isCashCloseOpen}
        expectedCashAmountCents={balance?.cash_amount_cents ?? 0}
        paymentCount={balance?.payment_count ?? 0}
        isSubmitting={isClosing}
        onOpenChange={setIsCashCloseOpen}
        onSubmit={handleCloseCash}
      />
    </div>
  );
};

export default DashboardHome;
