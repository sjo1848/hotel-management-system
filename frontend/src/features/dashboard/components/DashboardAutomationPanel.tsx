import { Bot, Sparkles, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AutomationInsights } from "@/features/dashboard/services/automationService";
import { cn } from "@/lib/utils";

type DashboardAutomationPanelProps = {
  loading: boolean;
  insights: AutomationInsights | null;
  onNavigate: (route: string) => void;
};

const severityClass: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200",
  medium:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200",
  low: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-200",
};

const featureLabel: Record<string, string> = {
  pricing_assistant: "Pricing Assistant",
  exception_notifications: "Notificaciones de Excepción",
  benchmarking_exports: "Export Benchmark",
  pricing_rules_automation: "Reglas de Pricing",
};

const DashboardAutomationPanel = ({
  loading,
  insights,
  onNavigate,
}: DashboardAutomationPanelProps) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
            Automation Control Tower
          </h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Señales operativas y comerciales por plan
          </p>
        </div>
        <Bot className="h-5 w-5 text-sky-600 dark:text-sky-300" />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : !insights ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          No hay insights disponibles para este hotel.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Plan {insights.plan_tier}
            </span>
            {Object.entries(featureLabel).map(([key, label]) => {
              const enabled = Boolean(insights.feature_flags[key as keyof typeof insights.feature_flags]);
              return (
                <span
                  key={key}
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-bold",
                    enabled
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-1 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Wrench className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                Housekeeping SLA
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Dirty: {insights.housekeeping_sla.dirty_rooms_count} | Cleaning:{" "}
                {insights.housekeeping_sla.cleaning_rooms_count} | Overdue:{" "}
                {insights.housekeeping_sla.overdue_rooms_count}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {insights.housekeeping_sla.recommendation}
              </p>
              {!insights.housekeeping_sla.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 rounded-lg text-xs"
                  onClick={() => onNavigate("/network")}
                >
                  Ver upgrade de plan
                </Button>
              ) : null}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-1 flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                Pricing Assistant
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Ocupación {insights.pricing_assistant.occupancy_rate.toFixed(1)}% | ADR $
                {(insights.pricing_assistant.adr_cents / 100).toLocaleString("es-AR")} | RevPAR $
                {(insights.pricing_assistant.rev_par_cents / 100).toLocaleString("es-AR")}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {insights.pricing_assistant.recommendation}
              </p>
              {!insights.pricing_assistant.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 rounded-lg text-xs"
                  onClick={() => onNavigate("/network")}
                >
                  Activar con plan PRO
                </Button>
              ) : null}
            </article>
          </div>

          <div className="space-y-2">
            {insights.exception_notifications.map((notification) => (
              <div
                key={notification.code}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2",
                  severityClass[notification.severity] ?? severityClass.info,
                )}
              >
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">
                      {notification.code}
                    </p>
                    <p className="text-sm font-semibold">{notification.message}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-current bg-transparent text-xs"
                  onClick={() => onNavigate(notification.action_route)}
                >
                  Resolver
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DashboardAutomationPanel;
