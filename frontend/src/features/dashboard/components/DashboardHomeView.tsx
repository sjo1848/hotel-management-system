import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  DollarSign,
  DoorOpen,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
  MoreVertical,
  Users,
} from "lucide-react";
import { type ElementType } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import BookingList from "@/features/bookings/components/BookingList";
import BookingEditDrawer from "@/features/bookings/components/BookingEditDrawer";
import {
  type DashboardKpis,
  type OccupancyReportItem,
  type RevenueReportItem,
} from "@/features/dashboard/services/analyticsService";
import { type CashBalance } from "@/features/dashboard/services/billingService";
import { type TenantFeatureFlags } from "@/features/dashboard/services/hotelService";

type KPICardProps = {
  title: string;
  value: string | number;
  subtext: string;
  trend: "up" | "down";
  icon: ElementType;
  accent: string;
  loading?: boolean;
};

const KPICard = ({ title, value, subtext, trend, icon: Icon, accent, loading }: KPICardProps) => (
  <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group hover:-translate-y-1 transition-all duration-300">
    <div className={cn("h-1 w-full", accent.replace("bg-", "bg-").replace("-50", "-500"))} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
        {title}
      </CardTitle>
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
          accent,
        )}
      >
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24 mb-2" />
      ) : (
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
      )}
      <div className="flex items-center gap-2 mt-2">
        {loading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <>
            <div
              className={cn(
                "flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md",
                trend === "up" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
              )}
            >
              {trend === "up" ? (
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
              )}
              {trend === "up" ? "12%" : "4%"}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{subtext}</span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

type DashboardHomeViewProps = {
  loading: boolean;
  loadError: string | null;
  isClosing: boolean;
  kpis: DashboardKpis | null;
  balance: CashBalance | null;
  revenueData: RevenueReportItem[];
  occupancyData: OccupancyReportItem[];
  dailyPriorities: RevenueCockpitPriority[];
  featureFlags: TenantFeatureFlags | null;
  automationInsights: AutomationInsight[];
  isDrawerOpen: boolean;
  selectedBookingId: string | null;
  onRetry: () => void;
  onNavigateBookings: () => void;
  onCloseCash: () => void;
  onRevenueCtaClick: (priority: RevenueCockpitPriority) => void;
  onAutomationAction: (insight: AutomationInsight) => void;
  onAlertSelect: (bookingId: string) => void;
  onDrawerClose: () => void;
  onDrawerSuccess: () => Promise<void>;
};

export type RevenueCockpitPriority = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  route: string;
  severity: "high" | "medium" | "low";
};

export type AutomationInsight = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  route: string;
  severity: "high" | "medium" | "low";
};

const AlertItem = ({
  alert,
  type,
  onClick,
}: {
  alert: DashboardKpis["arrivals_today"][number];
  type: "arrival" | "departure";
  onClick: (bookingId: string) => void;
}) => (
  <div
    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group cursor-pointer"
    onClick={() => onClick(alert.booking_id)}
  >
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          type === "arrival" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600",
        )}
      >
        {type === "arrival" ? <LogIn className="w-5 h-5" /> : <LogOutIcon className="w-5 h-5" />}
      </div>
      <div>
        <div className="text-sm font-black text-slate-900 tracking-tight">{alert.guest_name}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Habitación {alert.room_number}
        </div>
      </div>
    </div>
    <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
      <MoreVertical className="w-4 h-4 text-slate-400" />
    </Button>
  </div>
);

export const DashboardHomeView = ({
  loading,
  loadError,
  isClosing,
  kpis,
  balance,
  revenueData,
  occupancyData,
  dailyPriorities,
  featureFlags,
  automationInsights,
  isDrawerOpen,
  selectedBookingId,
  onRetry,
  onNavigateBookings,
  onCloseCash,
  onRevenueCtaClick,
  onAutomationAction,
  onAlertSelect,
  onDrawerClose,
  onDrawerSuccess,
}: DashboardHomeViewProps) => {
  const formattedRevenueData = revenueData.map((item) => ({
    ...item,
    amount: item.amount_cents / 100,
    dateLabel: format(new Date(item.date), "dd/MM"),
  }));

  const formattedOccupancyData = occupancyData.map((item) => ({
    ...item,
    rate: item.occupancy_rate,
    dateLabel: format(new Date(item.date), "dd/MM"),
  }));

  const occupancyTone =
    (kpis?.occupancy_rate ?? 0) >= 80 ? "text-emerald-600" : (kpis?.occupancy_rate ?? 0) >= 65 ? "text-amber-600" : "text-rose-600";

  const priorityTone = (severity: RevenueCockpitPriority["severity"]) => {
    if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-800";
    if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  };

  const automationTone = (severity: AutomationInsight["severity"]) => {
    if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-900";
    if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-900";
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Vista General</h2>
        <p className="text-slate-500 font-medium mt-2">Estado operativo del hotel en tiempo real.</p>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-700">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Ingresos (Mes)"
          value={`$${((kpis?.revenue_month_cents || 0) / 100).toLocaleString("es-AR")}`}
          subtext="vs mes pasado"
          trend="up"
          icon={DollarSign}
          accent="bg-emerald-50"
          loading={loading}
        />
        <KPICard
          title="Ocupación"
          value={`${kpis?.occupancy_rate.toFixed(1) || 0}%`}
          subtext="Hoy"
          trend="up"
          icon={DoorOpen}
          accent="bg-sky-50"
          loading={loading}
        />
        <KPICard
          title="Check-ins Hoy"
          value={kpis?.today_check_ins || 0}
          subtext="Pendientes"
          trend="down"
          icon={Users}
          accent="bg-amber-50"
          loading={loading}
        />
        <KPICard
          title="Reservas Activas"
          value={kpis?.active_bookings_count || 0}
          subtext="Total"
          trend="up"
          icon={CalendarCheck}
          accent="bg-indigo-50"
          loading={loading}
        />
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Revenue Cockpit</CardTitle>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                ADR, RevPAR y prioridades accionables del día
              </p>
            </div>
            <Badge variant="info" className="uppercase tracking-widest text-[10px]">
              Comercial V1
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">ADR</p>
              <p className="mt-2 text-3xl font-black text-slate-900">
                ${((kpis?.adr_cents ?? 0) / 100).toLocaleString("es-AR")}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Tarifa promedio por reserva activa</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">RevPAR</p>
              <p className="mt-2 text-3xl font-black text-slate-900">
                ${((kpis?.rev_par_cents ?? 0) / 100).toLocaleString("es-AR")}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Ingreso por habitación disponible</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ocupación</p>
              <p className={`mt-2 text-3xl font-black ${occupancyTone}`}>{(kpis?.occupancy_rate ?? 0).toFixed(1)}%</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Umbrales: bajo &lt;65, medio 65-79, alto ≥80</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {dailyPriorities.map((priority) => (
              <div key={priority.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-900">{priority.title}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${priorityTone(
                      priority.severity,
                    )}`}
                  >
                    {priority.severity}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">{priority.description}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-xl border-slate-200 bg-white text-slate-800"
                  onClick={() => onRevenueCtaClick(priority)}
                >
                  {priority.actionLabel}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {featureFlags?.automation_alerts_enabled ? (
        <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Automation & Alerts</CardTitle>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                  SLA housekeeping, pricing asistido y excepciones operativas
                </p>
              </div>
              <Badge variant="secondary" className="uppercase tracking-widest text-[10px]">
                Plan {featureFlags.plan_tier}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {automationInsights.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
                Sin alertas de automatización para este momento.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {automationInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`rounded-2xl border p-4 shadow-sm ${automationTone(insight.severity)}`}
                  >
                    <p className="text-sm font-black">{insight.title}</p>
                    <p className="mt-1 text-xs font-medium">{insight.description}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-4 border-white/70 bg-white text-slate-800"
                      onClick={() => onAutomationAction(insight)}
                    >
                      {insight.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!featureFlags.pricing_assistant_enabled ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Pricing asistido disponible en plan PRO/ENTERPRISE.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-3xl overflow-hidden bg-white p-6">
          <div className="flex flex-col mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tendencia de Ingresos</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos 30 días</p>
          </div>
          <div className="h-[250px] w-full">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedRevenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="dateLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, "Ingreso"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-3xl overflow-hidden bg-white p-6">
          <div className="flex flex-col mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Tasa de Ocupación</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Ocupación diaria (%)</p>
          </div>
          <div className="h-[250px] w-full">
            {loading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedOccupancyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="dateLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "16px",
                      border: "none",
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value) => [`${Number(value ?? 0)}%`, "Ocupación"]}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {formattedOccupancyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.rate > 80 ? "#6366f1" : "#cbd5e1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-3xl overflow-hidden bg-slate-900 text-white h-full relative group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <DollarSign className="w-24 h-24" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-black tracking-tight">Cierre de Caja</CardTitle>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Balance del Turno Actual</p>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="space-y-1">
                <p className="text-4xl font-black text-white">
                  ${((balance?.total_amount_cents || 0) / 100).toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                  Ingresos totales acumulados
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/10">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Efectivo</p>
                  <p className="text-lg font-bold text-white">${((balance?.cash_amount_cents || 0) / 100).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Tarjeta</p>
                  <p className="text-lg font-bold text-white">${((balance?.card_amount_cents || 0) / 100).toLocaleString()}</p>
                </div>
              </div>

              <Button
                onClick={onCloseCash}
                disabled={isClosing || (balance?.total_amount_cents || 0) === 0}
                className="w-full h-12 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl"
              >
                {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar Turno y Cerrar Caja"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Alertas de Hoy</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Llegadas y Salidas</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Check-ins ({kpis?.arrivals_today.length || 0})
              </span>
              {loading ? (
                Array(2)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : kpis?.arrivals_today.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                  Sin llegadas hoy
                </div>
              ) : (
                kpis?.arrivals_today.map((alert) => (
                  <AlertItem key={alert.booking_id} alert={alert} type="arrival" onClick={onAlertSelect} />
                ))
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Check-outs ({kpis?.departures_today.length || 0})
              </span>
              {loading ? (
                Array(2)
                  .fill(0)
                  .map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : kpis?.departures_today.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                  Sin salidas hoy
                </div>
              ) : (
                kpis?.departures_today.map((alert) => (
                  <AlertItem key={alert.booking_id} alert={alert} type="departure" onClick={onAlertSelect} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden rounded-3xl h-full">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6 px-8">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Últimas Reservas</CardTitle>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Actividad reciente</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200 bg-white"
                  onClick={onNavigateBookings}
                >
                  Ver todo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 text-slate-900 bg-white">
              <BookingList />
            </CardContent>
          </Card>
        </div>
      </div>

      <BookingEditDrawer
        booking={null}
        bookingId={selectedBookingId}
        isOpen={isDrawerOpen}
        onClose={onDrawerClose}
        onSuccess={onDrawerSuccess}
      />
    </div>
  );
};

export default DashboardHomeView;
