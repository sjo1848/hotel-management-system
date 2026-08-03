import { BrainCircuit, ShieldCheck } from "lucide-react";
import DashboardPriorityList from "./DashboardPriorityList";
import HotelPulseSummary from "./HotelPulseSummary";
import CashShiftSummary from "./CashShiftSummary";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";
import type { CashBalance } from "@/features/dashboard/services/billingService";
import type { TenantFeatureFlags } from "@/features/dashboard/services/hotelService";
import type { DashboardPriority } from "@/features/dashboard/utils/dashboardPriorities";

type DashboardOperationPanelProps = {
  priorities: DashboardPriority[];
  prioritiesLoading: boolean;
  hasCapability: (route?: string) => boolean;
  onPriorityAction: (priority: DashboardPriority) => void;
  onNavigateCalendar: () => void;
  kpis: DashboardKpis | null;
  kpisLoading: boolean;
  featureFlags: TenantFeatureFlags | null;
  balance: CashBalance | null;
  balanceLoading: boolean;
  balanceError: string | null;
  isClosing: boolean;
  canCloseCash: boolean;
  cashCloseOpen: boolean;
  onOpenCashClose: () => void;
  onRetryCash: () => void;
};

const DashboardOperationPanel = ({
  priorities,
  prioritiesLoading,
  hasCapability,
  onPriorityAction,
  onNavigateCalendar,
  kpis,
  kpisLoading,
  featureFlags,
  balance,
  balanceLoading,
  balanceError,
  isClosing,
  canCloseCash,
  cashCloseOpen,
  onOpenCashClose,
  onRetryCash,
}: DashboardOperationPanelProps) => {
  const automationEnabled = featureFlags?.automation_alerts_enabled ?? false;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="min-w-0 space-y-5 lg:col-span-3">
        <DashboardPriorityList
          priorities={priorities}
          loading={prioritiesLoading}
          hasCapability={hasCapability}
          onAction={onPriorityAction}
          onNavigateCalendar={onNavigateCalendar}
        />
        {automationEnabled ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-bold text-muted-foreground">
              Automatizaciones activas
              {featureFlags?.pricing_assistant_enabled ? " · Pricing asistido habilitado" : ""}
            </p>
            <BrainCircuit className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 space-y-5 lg:col-span-2">
        <HotelPulseSummary kpis={kpis} loading={kpisLoading} />
        <CashShiftSummary
          balance={balance}
          loading={balanceLoading}
          error={balanceError}
          isClosing={isClosing}
          cashCloseOpen={cashCloseOpen}
          canCloseCash={canCloseCash}
          onOpenCashClose={onOpenCashClose}
          onRetry={onRetryCash}
        />
      </div>
    </div>
  );
};

export default DashboardOperationPanel;
