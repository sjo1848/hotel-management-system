import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  CalendarRange,
  CreditCard,
  Download,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/async-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard, SectionEyebrow } from "@/components/ui/section-card";
import { cn, downloadCSV } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  getCashBalance,
  getCashClosures,
  getOccupancyReport,
  getRevenueReport,
  type CashBalance,
  type CashClosure,
  type OccupancyData,
  type RevenueData,
} from "./services/reportingService";

type ReportsBundle = {
  revenueData: RevenueData[];
  occupancyData: OccupancyData[];
  balance: CashBalance;
  closures: CashClosure[];
};

const PRESET_DAYS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
];

const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString("es-AR")}`;
const formatShortDate = (value: string) => format(new Date(`${value}T00:00:00`), "dd MMM");
const formatDateTime = (value: string) => format(new Date(value), "dd MMM · HH:mm");

const normalizeRevenue = (row: RevenueData) => row.amount_cents ?? row.revenue_cents ?? 0;

const ReportsPage = () => {
  const { toast } = useToast();
  const [presetDays, setPresetDays] = useState(30);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const isMobile = useMediaQuery("(max-width: 767px)");

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useResourceQuery<ReportsBundle>({
    queryKey: `reports:${startDate}:${endDate}`,
    queryFn: async () => {
      const [revenueData, occupancyData, balance, closures] = await Promise.all([
        getRevenueReport(startDate, endDate),
        getOccupancyReport(startDate, endDate),
        getCashBalance(),
        getCashClosures(),
      ]);
      return { revenueData, occupancyData, balance, closures };
    },
    staleTimeMs: 15_000,
    retry: false,
  });

  const revenueData = data?.revenueData ?? [];
  const occupancyData = data?.occupancyData ?? [];
  const balance = data?.balance ?? null;
  const closures = data?.closures ?? [];

  const totals = useMemo(() => {
    const totalRevenue = revenueData.reduce((sum, item) => sum + normalizeRevenue(item), 0);
    const avgOccupancy = occupancyData.length
      ? occupancyData.reduce((sum, item) => sum + item.occupancy_rate, 0) / occupancyData.length
      : 0;
    const topRevenueDay = revenueData.reduce<RevenueData | null>((best, item) => {
      if (!best) return item;
      return normalizeRevenue(item) > normalizeRevenue(best) ? item : best;
    }, null);
    return { totalRevenue, avgOccupancy, topRevenueDay };
  }, [occupancyData, revenueData]);

  const closureSummary = useMemo(() => {
    return closures.slice(0, 3).map((closure) => ({
      ...closure,
      cashShare:
        closure.total_amount_cents > 0
          ? Math.round((closure.cash_amount_cents / closure.total_amount_cents) * 100)
          : 0,
      cardTransferShare:
        closure.total_amount_cents > 0
          ? Math.round((closure.card_amount_cents / closure.total_amount_cents) * 100)
          : 0,
    }));
  }, [closures]);

  const applyPreset = (days: number) => {
    setPresetDays(days);
    setStartDate(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setEndDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleExportRevenue = () => {
    if (revenueData.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay ingresos para exportar en el rango seleccionado.",
        variant: "default",
      });
      return;
    }
    downloadCSV(
      revenueData.map((item) => ({
        date: item.date,
        revenue_ars: normalizeRevenue(item) / 100,
      })),
      `reporte_ingresos_${startDate}_${endDate}.csv`,
    );
    toast({
      title: "Exportacion lista",
      description: "Se descargo el CSV de ingresos.",
      variant: "success",
    });
  };

  const statCards = [
    {
      label: "Ingresos del rango",
      value: formatCurrency(totals.totalRevenue),
      hint: `${revenueData.length} dias con facturacion`,
      icon: TrendingUp,
      tone: "border-primary/20 bg-primary/10 text-primary",
    },
    {
      label: "Ocupacion promedio",
      value: `${totals.avgOccupancy.toFixed(1)}%`,
      hint: `${occupancyData.length} dias analizados`,
      icon: Activity,
      tone: "border-primary/20 bg-primary/10 text-primary",
    },
    {
      label: "Caja abierta",
      value: formatCurrency(balance?.total_amount_cents ?? 0),
      hint: `${balance?.payment_count ?? 0} cobros · Pendiente ${formatCurrency(balance?.pending_amount_cents ?? 0)}`,
      icon: Wallet,
      tone: "border-amber-100 bg-amber-50 text-amber-700",
    },
    {
      label: "Pico diario",
      value: totals.topRevenueDay ? formatCurrency(normalizeRevenue(totals.topRevenueDay)) : "$0",
      hint: totals.topRevenueDay ? formatShortDate(totals.topRevenueDay.date) : "Sin datos",
      icon: Receipt,
      tone: "border-primary/20 bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {isMobile ? (
        <div className="space-y-3">
          <div className="flex min-h-11 items-center justify-between gap-3" aria-label="Encabezado de reportes">
            <div className="min-w-0"><h1 className="truncate text-xl font-black">Reportes</h1><p className="truncate text-xs text-muted-foreground">Indicadores y caja</p></div>
            <div className="flex gap-2">
              <Button size="icon" className="h-11 w-11 rounded-xl" aria-label="Exportar ingresos" onClick={handleExportRevenue}><Download className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-label="Rangos rápidos">
            {PRESET_DAYS.map((preset) => <Button key={preset.value} variant={presetDays === preset.value ? "default" : "outline"} className="min-h-11 rounded-xl px-2" onClick={() => applyPreset(preset.value)}>{preset.label}</Button>)}
          </div>
        </div>
      ) : <PageHeader
        title="Reportes"
        description={isMobile ? "Indicadores y caja" : "Cockpit financiero y operativo con ingresos, ocupacion y caja sobre el dataset demo real."}
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {PRESET_DAYS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={presetDays === preset.value ? "default" : "outline"}
                  className="h-10 flex-1 rounded-xl sm:flex-none"
                  onClick={() => applyPreset(preset.value)}
                >
                  <CalendarRange className="h-4 w-4" />
                  {preset.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" className="h-10 w-full rounded-xl sm:w-auto" onClick={() => void refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Recargar
            </Button>
            <Button className="h-10 w-full rounded-xl shadow-lg sm:w-auto" onClick={handleExportRevenue}>
              <Download className="h-4 w-4" />
              Exportar ingresos
            </Button>
          </>
        }
      />}

      <details className="rounded-2xl border border-border bg-card px-4 py-3 md:hidden">
        <summary className="cursor-pointer text-sm font-bold">Personalizar fechas</summary>
        <div className="mt-4 grid gap-3">
          <label className="space-y-2"><SectionEyebrow>Desde</SectionEyebrow><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold" /></label>
          <label className="space-y-2"><SectionEyebrow>Hasta</SectionEyebrow><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold" /></label>
        </div>
      </details>

      <SectionCard className="motion-refresh hidden gap-3 p-4 md:grid md:grid-cols-3">
        <label className="space-y-2">
          <SectionEyebrow>Desde</SectionEyebrow>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/40"
          />
        </label>
        <label className="space-y-2">
          <SectionEyebrow>Hasta</SectionEyebrow>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition focus:border-primary/40"
          />
        </label>
        <div className="hidden rounded-2xl border border-border bg-muted/40 p-4 md:block">
          <SectionEyebrow>Ventana activa</SectionEyebrow>
          <p className="mt-3 text-lg font-black text-foreground">
            {formatShortDate(startDate)} - {formatShortDate(endDate)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rango seleccionado para los indicadores y cierres de esta vista.
          </p>
        </div>
      </SectionCard>

      {error ? (
        <ErrorState
          message="No se pudieron cargar los reportes analiticos."
          onRetry={() => void refetch()}
        />
      ) : null}

      {isLoading ? <LoadingState label="Cargando reportes..." /> : null}

      {!isLoading && !error && revenueData.length === 0 && occupancyData.length === 0 ? (
        <SectionCard>
          <p role="status" className="py-10 text-center text-sm text-muted-foreground">
            No hay datos en el rango seleccionado. Probá ampliar el rango o cambiar el período.
          </p>
        </SectionCard>
      ) : null}

      {!isLoading && !error && (revenueData.length > 0 || occupancyData.length > 0) ? (
        <>
          <section className="stagger-list grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.label}
                  className={cn("motion-surface motion-lift rounded-2xl border p-4 shadow-sm", card.tone, isMobile && card.label === "Pico diario" ? "hidden" : "")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <SectionEyebrow className="text-current">{card.label}</SectionEyebrow>
                      <p className="mt-2 text-3xl font-black tracking-tight">{card.value}</p>
                      <p className="mt-2 text-sm opacity-80">{card.hint}</p>
                    </div>
                    <div className="rounded-2xl bg-card p-3 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <SectionCard as="article" className="motion-refresh">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <SectionEyebrow>Ingresos diarios</SectionEyebrow>
                  <h3 className="mt-2 text-xl font-black text-foreground sm:text-2xl">Flujo de ingresos del periodo</h3>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {formatCurrency(totals.totalRevenue)}
                </span>
              </div>
              <div className="mt-6 h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="reportsRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4ea" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${Math.round(Number(value) / 1000) / 10}k`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "18px",
                        border: "1px solid rgba(148,163,184,0.18)",
                        boxShadow: "0 20px 45px -22px rgba(15, 23, 42, 0.35)",
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), "Ingresos"]}
                      labelFormatter={(label) => formatShortDate(String(label))}
                    />
                    <Area
                      type="monotone"
                      dataKey={(row: RevenueData) => normalizeRevenue(row)}
                      stroke="#0f766e"
                      strokeWidth={3}
                      fill="url(#reportsRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard as="article" className="motion-refresh">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <SectionEyebrow>Ocupacion</SectionEyebrow>
                  <h3 className="mt-2 text-xl font-black text-foreground sm:text-2xl">Eficiencia de inventario</h3>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {totals.avgOccupancy.toFixed(1)}%
                </span>
              </div>
              <div className="mt-6 h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={occupancyData}>
                    <defs>
                      <linearGradient id="reportsOccupancy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4ea" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "18px",
                        border: "1px solid rgba(148,163,184,0.18)",
                        boxShadow: "0 20px 45px -22px rgba(15, 23, 42, 0.35)",
                      }}
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, "Ocupacion"]}
                      labelFormatter={(label) => formatShortDate(String(label))}
                    />
                    <Area
                      type="monotone"
                      dataKey="occupancy_rate"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fill="url(#reportsOccupancy)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard as="article" className="motion-refresh">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <SectionEyebrow>Caja y cierres</SectionEyebrow>
                  <h3 className="mt-2 text-2xl font-black text-foreground">Ultimos cierres registrados</h3>
                </div>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  {closures.length} cierres
                </span>
              </div>

              <div className="stagger-list mt-5 space-y-3">
                {closureSummary.map((closure) => (
                  <div
                    key={closure.id}
                    className="motion-surface motion-lift rounded-2xl border border-border bg-muted/30 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground">
                          {formatCurrency(closure.total_amount_cents)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDateTime(closure.opening_time)} - {formatDateTime(closure.closing_time)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {closure.notes || "Sin notas operativas"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-foreground">
                          Handoff: {closure.handoff_to}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:text-right">
                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                          Cash {closure.cashShare}% · Card/Transfer {closure.cardTransferShare}%
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {closure.payment_count} cobros en el turno
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Efectivo {formatCurrency(closure.cash_amount_cents)} · Contado{" "}
                          {formatCurrency(closure.counted_cash_amount_cents)}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          Tarjeta/transfer {formatCurrency(closure.card_amount_cents)} · Diferencia{" "}
                          {formatCurrency(closure.cash_difference_cents)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard as="article" className="motion-refresh">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionEyebrow>Mix actual</SectionEyebrow>
                  <h3 className="mt-2 text-2xl font-black text-foreground">Balance desde ultimo cierre</h3>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <SectionEyebrow>Total abierto</SectionEyebrow>
                  <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
                    {formatCurrency(balance?.total_amount_cents ?? 0)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="motion-surface rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary">
                    <SectionEyebrow className="text-current">Efectivo</SectionEyebrow>
                    <p className="mt-3 text-2xl font-black">
                      {formatCurrency(balance?.cash_amount_cents ?? 0)}
                    </p>
                  </div>
                  <div className="motion-surface rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary">
                    <SectionEyebrow className="text-current">Tarjeta y transfer</SectionEyebrow>
                    <p className="mt-3 text-2xl font-black">
                      {formatCurrency(balance?.card_amount_cents ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    El balance actual ya parte desde el ultimo cierre sembrado en demo.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Esto evita que dashboard y reportes muestren caja acumulada sin contexto de turnos.
                  </p>
                </div>
                </div>
            </SectionCard>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default ReportsPage;
