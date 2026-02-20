import { ArrowDownRight, ArrowUpRight, CalendarCheck, DoorOpen, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

type DashboardKpiGridProps = {
  kpis: DashboardKpis | null;
  loading: boolean;
};

type KpiCardProps = {
  title: string;
  value: string | number;
  subtext: string;
  trend: "up" | "down";
  accent: string;
  loading?: boolean;
  icon: React.ElementType;
};

const KpiCard = ({ title, value, subtext, trend, accent, loading, icon: Icon }: KpiCardProps) => (
  <Card className="group overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/40 transition-all duration-300 hover:-translate-y-1">
    <div className={cn("h-1 w-full", accent.replace("-50", "-500"))} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</CardTitle>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110", accent)}>
        <Icon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
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
          <Skeleton className="h-4 w-32" />
        ) : (
          <>
            <div
              className={cn(
                "flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-black",
                trend === "up"
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200"
                  : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200",
              )}
            >
              {trend === "up" ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
              {trend === "up" ? "12%" : "4%"}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400">{subtext}</span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

const DashboardKpiGrid = ({ kpis, loading }: DashboardKpiGridProps) => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
    <KpiCard
      title="Ingresos (Mes)"
      value={`$${((kpis?.revenue_month_cents ?? 0) / 100).toLocaleString("es-AR")}`}
      subtext="vs mes pasado"
      trend="up"
      accent="bg-emerald-50"
      icon={DollarSign}
      loading={loading}
    />
    <KpiCard
      title="Ocupación"
      value={`${kpis?.occupancy_rate.toFixed(1) ?? 0}%`}
      subtext="Hoy"
      trend="up"
      accent="bg-sky-50"
      icon={DoorOpen}
      loading={loading}
    />
    <KpiCard
      title="Check-ins Hoy"
      value={kpis?.today_check_ins ?? 0}
      subtext="Pendientes"
      trend="down"
      accent="bg-amber-50"
      icon={Users}
      loading={loading}
    />
    <KpiCard
      title="Reservas Activas"
      value={kpis?.active_bookings_count ?? 0}
      subtext="Total"
      trend="up"
      accent="bg-indigo-50"
      icon={CalendarCheck}
      loading={loading}
    />
  </div>
);

export default DashboardKpiGrid;
