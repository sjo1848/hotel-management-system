import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, ChartNoAxesColumnIncreasing, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UseResourceQueryResult } from "@/lib/useResourceQuery";
import type { DashboardKpis, OccupancyReportItem, RevenueReportItem } from "@/features/dashboard/services/analyticsService";
import {
  REPORT_RANGE_LABELS,
  getReportRange,
  type ReportRange,
} from "@/features/dashboard/utils/reportRange";

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

const formatCurrencyCompact = (cents: number) =>
  cents === 0
    ? "$0"
    : `$${(cents / 100).toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 })}`;

const formatDay = (isoDate: string) => {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
};

const describeSeries = (label: string, items: Array<{ value: number }>) => {
  if (items.length === 0) return `${label}: no hay datos para el rango seleccionado.`;
  const values = items.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  return `${label}: mínimo ${min}, máximo ${max}, último ${last} en el periodo.`;
};

type RangeSelectorProps = {
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
};

const RangeSelector = ({ range, onRangeChange }: RangeSelectorProps) => (
  <div
    role="group"
    aria-label="Rango de reportes"
    className="flex gap-1 rounded-2xl border border-border bg-muted p-1"
  >
    {(["7d", "30d"] as const).map((option) => (
      <button
        key={option}
        type="button"
        aria-pressed={range === option}
        className={cn(
          "h-11 rounded-xl px-4 text-sm font-bold transition",
          range === option
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
        )}
        onClick={() => onRangeChange(option)}
      >
        {REPORT_RANGE_LABELS[option]}
      </button>
    ))}
  </div>
);

type MetricChartProps = {
  title: string;
  rangeLabel: string;
  items: Array<{ date: string; value: number }>;
  loading: boolean;
  error: string | null;
  hasStaleData: boolean;
  unit: "currency" | "percent";
  onRetry: () => void;
};

const MetricChart = ({
  title,
  rangeLabel,
  items,
  loading,
  error,
  hasStaleData,
  unit,
  onRetry,
}: MetricChartProps) => {
  const empty = items.length === 0;

  if (error && !hasStaleData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-black text-foreground">No se pudo cargar {title.toLowerCase()}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          El resto del panel sigue disponible.
        </p>
        <Button type="button" variant="outline" className="mt-4 h-11 rounded-xl" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs font-bold text-muted-foreground">{rangeLabel}</span>
      </div>

      <div
        role="img"
        aria-label={describeSeries(title, items)}
        className="mt-4 h-56 w-full"
      >
        {loading && !hasStaleData ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">No hay datos para el rango seleccionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {unit === "currency" ? (
              <LineChart data={items} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={formatDay} fontSize={11} stroke="currentColor" />
                <YAxis
                  tickFormatter={(value: number) => formatCurrencyCompact(value)}
                  fontSize={11}
                  stroke="currentColor"
                  width={58}
                />
                <Tooltip
                  formatter={(value?: number) => formatCurrency(value ?? 0)}
                  labelFormatter={(label) => formatDay(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            ) : (
              <BarChart data={items} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tickFormatter={formatDay} fontSize={11} stroke="currentColor" />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  fontSize={11}
                  stroke="currentColor"
                  width={46}
                />
                <Tooltip
                  formatter={(value?: number) => `${(value ?? 0).toFixed(1)}%`}
                  labelFormatter={(label) => formatDay(String(label))}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {error && hasStaleData ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
            No se pudo actualizar. Mostrando datos previos.
          </p>
          <Button type="button" variant="outline" className="h-11 rounded-xl px-3" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : null}
    </div>
  );
};

type DashboardPerformancePanelProps = {
  enabled: boolean;
  kpis: DashboardKpis | null;
  range: ReportRange;
  onRangeChange: (range: ReportRange) => void;
  revenueQuery: UseResourceQueryResult<RevenueReportItem[]>;
  occupancyQuery: UseResourceQueryResult<OccupancyReportItem[]>;
  hasCapability: (route?: string) => boolean;
  onOpenReports: () => void;
};

const DashboardPerformancePanel = ({
  enabled,
  kpis,
  range,
  onRangeChange,
  revenueQuery,
  occupancyQuery,
  hasCapability,
  onOpenReports,
}: DashboardPerformancePanelProps) => {
  const [lastRevenue, setLastRevenue] = useState<RevenueReportItem[]>([]);
  const [lastOccupancy, setLastOccupancy] = useState<OccupancyReportItem[]>([]);

  useEffect(() => {
    if (revenueQuery.data) setLastRevenue(revenueQuery.data);
  }, [revenueQuery.data]);

  useEffect(() => {
    if (occupancyQuery.data) setLastOccupancy(occupancyQuery.data);
  }, [occupancyQuery.data]);

  const { start, end } = getReportRange(range);
  const rangeLabel = `${start} a ${end}`;

  const revenueItems = useMemo(
    () => (revenueQuery.data ?? lastRevenue).map((item) => ({ date: item.date, value: item.amount_cents })),
    [lastRevenue, revenueQuery.data],
  );
  const occupancyItems = useMemo(
    () => (occupancyQuery.data ?? lastOccupancy).map((item) => ({ date: item.date, value: item.occupancy_rate })),
    [lastOccupancy, occupancyQuery.data],
  );

  if (!enabled) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeSelector range={range} onRangeChange={onRangeChange} />
        <span className="text-xs font-bold text-muted-foreground">Periodo: {rangeLabel}</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Ingresos
            </p>
          </div>
          {kpis ? (
            <p className="mt-2 text-2xl font-black leading-none text-foreground">
              {formatCurrency(kpis.revenue_month_cents)}
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-32" />
          )}
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Mes actual</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ChartNoAxesColumnIncreasing className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Ocupación
            </p>
          </div>
          {kpis ? (
            <p className="mt-2 text-2xl font-black leading-none text-foreground">
              {kpis.occupancy_rate.toFixed(1)}%
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-24" />
          )}
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Hoy</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              ADR
            </p>
          </div>
          {kpis ? (
            <p className="mt-2 text-2xl font-black leading-none text-foreground">
              {formatCurrency(kpis.adr_cents)}
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-28" />
          )}
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Hoy</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              RevPAR
            </p>
          </div>
          {kpis ? (
            <p className="mt-2 text-2xl font-black leading-none text-foreground">
              {formatCurrency(kpis.rev_par_cents)}
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-28" />
          )}
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Hoy</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MetricChart
          title="Tendencia de ingresos"
          rangeLabel={rangeLabel}
          items={revenueItems}
          loading={revenueQuery.isLoading}
          error={revenueQuery.error}
          hasStaleData={revenueItems.length > 0 && Boolean(revenueQuery.error)}
          unit="currency"
          onRetry={() => void revenueQuery.refetch()}
        />
        <MetricChart
          title="Tendencia de ocupación"
          rangeLabel={rangeLabel}
          items={occupancyItems}
          loading={occupancyQuery.isLoading}
          error={occupancyQuery.error}
          hasStaleData={occupancyItems.length > 0 && Boolean(occupancyQuery.error)}
          unit="percent"
          onRetry={() => void occupancyQuery.refetch()}
        />
      </div>

      {hasCapability("/reports") ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={onOpenReports}
          >
            Abrir Reportes
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPerformancePanel;
