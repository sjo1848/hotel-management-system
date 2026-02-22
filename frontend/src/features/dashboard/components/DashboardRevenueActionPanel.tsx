import { AlertTriangle, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

export type RevenueActionId =
  | "raise_occupancy_72h"
  | "improve_rate_mix"
  | "prioritize_arrivals"
  | "protect_checkout_to_invoice"
  | "review_revenue_trend";

type RevenueAction = {
  id: RevenueActionId;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  ctaLabel: string;
  route: string;
};

type DashboardRevenueActionPanelProps = {
  loading: boolean;
  kpis: DashboardKpis | null;
  onAction: (actionId: RevenueActionId, route: string) => void;
};

const severityClass: Record<RevenueAction["severity"], string> = {
  high: "border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/30",
  medium: "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30",
  low: "border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30",
};

const severityLabelClass: Record<RevenueAction["severity"], string> = {
  high: "text-rose-700 dark:text-rose-200",
  medium: "text-amber-700 dark:text-amber-200",
  low: "text-emerald-700 dark:text-emerald-200",
};

const buildActions = (kpis: DashboardKpis): RevenueAction[] => {
  const actions: RevenueAction[] = [];

  if (kpis.occupancy_rate < 65) {
    actions.push({
      id: "raise_occupancy_72h",
      title: "Ocupación por debajo de objetivo",
      description: "Activá campañas de última hora para los próximos 3 días.",
      severity: "high",
      ctaLabel: "Ver reporte de revenue",
      route: "/reports",
    });
  }

  if (kpis.rev_par_cents < 8_000) {
    actions.push({
      id: "improve_rate_mix",
      title: "RevPAR bajo para el nivel de demanda",
      description: "Revisá mezcla de tarifas y upselling en reservas activas.",
      severity: kpis.occupancy_rate < 65 ? "high" : "medium",
      ctaLabel: "Ajustar estrategia de precio",
      route: "/reports",
    });
  }

  if (kpis.today_check_ins > 0 || kpis.arrivals_today.length > 0) {
    actions.push({
      id: "prioritize_arrivals",
      title: "Llegadas del día en ventana operativa",
      description: "Priorizá pre-check-in y asignación de habitaciones para evitar esperas.",
      severity: "medium",
      ctaLabel: "Ir a reservas",
      route: "/bookings",
    });
  }

  if (kpis.departures_today.length > 0) {
    actions.push({
      id: "protect_checkout_to_invoice",
      title: "Checkout con impacto en facturación",
      description: "Asegurá checkout e invoice en el mismo flujo para no perder ingresos.",
      severity: "medium",
      ctaLabel: "Controlar checkouts",
      route: "/bookings",
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "review_revenue_trend",
      title: "Cockpit estable",
      description: "Tus KPIs están en zona saludable. Validá tendencia semanal.",
      severity: "low",
      ctaLabel: "Abrir reportes",
      route: "/reports",
    });
  }

  return actions.slice(0, 4);
};

const DashboardRevenueActionPanel = ({ loading, kpis, onAction }: DashboardRevenueActionPanelProps) => {
  const actions = kpis ? buildActions(kpis) : [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Revenue Cockpit Accionable</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Prioridades comerciales del día
          </p>
        </div>
        <TrendingUp className="h-5 w-5 text-indigo-500 dark:text-indigo-300" />
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`revenue-action-sk-${index}`} className="h-24 w-full rounded-2xl" />
            ))
          : actions.map((action) => (
              <article
                key={action.id}
                className={cn("rounded-2xl border p-4 transition-all", severityClass[action.severity])}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {action.severity === "low" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                      )}
                      <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", severityLabelClass[action.severity])}>
                        {action.severity === "high" ? "Alta prioridad" : action.severity === "medium" ? "Prioridad media" : "Estable"}
                      </span>
                    </div>
                    <h4 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">{action.title}</h4>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{action.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => onAction(action.id, action.route)}
                  >
                    {action.ctaLabel}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
};

export default DashboardRevenueActionPanel;
