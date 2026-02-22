import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  DollarSign,
  Hotel,
  LineChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

type DashboardKpiGridProps = {
  kpis: DashboardKpis | null;
  loading: boolean;
};

type MetricHealth = "on_track" | "watch" | "critical";

type KpiCardProps = {
  title: string;
  value: string;
  objectiveLabel: string;
  health: MetricHealth;
  icon: React.ElementType;
  loading?: boolean;
};

const healthBadgeClass: Record<MetricHealth, string> = {
  on_track: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  watch: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
};

const healthLabel: Record<MetricHealth, string> = {
  on_track: "En objetivo",
  watch: "Atención",
  critical: "Prioridad",
};

const healthIcon = (health: MetricHealth) =>
  health === "on_track" ? (
    <ArrowUpRight className="h-3 w-3" />
  ) : (
    <ArrowDownRight className="h-3 w-3" />
  );

const currency = (amountCents: number) => `$${(amountCents / 100).toLocaleString("es-AR")}`;

const getOccupancyHealth = (rate: number): MetricHealth => {
  if (rate >= 75) return "on_track";
  if (rate >= 65) return "watch";
  return "critical";
};

const getAdrHealth = (adrCents: number): MetricHealth => {
  if (adrCents >= 16_000) return "on_track";
  if (adrCents >= 12_000) return "watch";
  return "critical";
};

const getRevParHealth = (revParCents: number): MetricHealth => {
  if (revParCents >= 12_000) return "on_track";
  if (revParCents >= 8_000) return "watch";
  return "critical";
};

const KpiCard = ({ title, value, objectiveLabel, health, icon: Icon, loading }: KpiCardProps) => (
  <Card className="group overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {title}
      </CardTitle>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-transform group-hover:scale-110 dark:bg-slate-800 dark:text-slate-200">
        <Icon className="h-5 w-5" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="mb-2 h-8 w-24" />
      ) : (
        <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      )}
      <div className="mt-2 flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-4 w-36" />
        ) : (
          <>
            <div className={cn("flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-black", healthBadgeClass[health])}>
              {healthIcon(health)}
              <span className="ml-0.5">{healthLabel[health]}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400">
              {objectiveLabel}
            </span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

const DashboardKpiGrid = ({ kpis, loading }: DashboardKpiGridProps) => (
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <KpiCard
      title="Ocupación"
      value={`${kpis?.occupancy_rate.toFixed(1) ?? 0}%`}
      objectiveLabel="objetivo >= 75%"
      health={getOccupancyHealth(kpis?.occupancy_rate ?? 0)}
      icon={Hotel}
      loading={loading}
    />
    <KpiCard
      title="ADR"
      value={currency(kpis?.adr_cents ?? 0)}
      objectiveLabel="objetivo >= $160"
      health={getAdrHealth(kpis?.adr_cents ?? 0)}
      icon={LineChart}
      loading={loading}
    />
    <KpiCard
      title="RevPAR"
      value={currency(kpis?.rev_par_cents ?? 0)}
      objectiveLabel="objetivo >= $120"
      health={getRevParHealth(kpis?.rev_par_cents ?? 0)}
      icon={Activity}
      loading={loading}
    />
    <KpiCard
      title="Ingresos (Mes)"
      value={currency(kpis?.revenue_month_cents ?? 0)}
      objectiveLabel="corte mensual"
      health="on_track"
      icon={DollarSign}
      loading={loading}
    />
    <KpiCard
      title="Check-ins Hoy"
      value={(kpis?.today_check_ins ?? 0).toString()}
      objectiveLabel="operación del día"
      health={kpis && kpis.today_check_ins > 0 ? "watch" : "on_track"}
      icon={CalendarCheck}
      loading={loading}
    />
    <KpiCard
      title="Reservas Activas"
      value={(kpis?.active_bookings_count ?? 0).toString()}
      objectiveLabel="pipeline vigente"
      health={kpis && kpis.active_bookings_count > 0 ? "on_track" : "watch"}
      icon={Activity}
      loading={loading}
    />
  </div>
);

export default DashboardKpiGrid;
