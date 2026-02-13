import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  Users,
  DoorOpen,
  DollarSign,
  CalendarCheck,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
  MoreVertical,
 
} from "lucide-react";
import BookingList from "@/features/bookings/components/BookingList";
import BookingEditDrawer from "@/features/bookings/components/BookingEditDrawer";
import { format } from "date-fns";
import { 
  getDashboardKpis, 
  getRevenueReport, 
  getOccupancyReport,
  type DashboardKpis,
  type RevenueReportItem,
  type OccupancyReportItem
} from "./services/analyticsService";
import { getCashBalance, closeCash, type CashBalance } from "./services/billingService";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { trackUiEvent } from "@/lib/telemetry";
import { getErrorMessage } from "@/api/errors";

type KPICardProps = {
  title: string;
  value: string | number;
  subtext: string;
  trend: "up" | "down";
  icon: React.ElementType;
  accent: string;
  loading?: boolean;
};

const KPICard = ({ title, value, subtext, trend, icon: Icon, accent, loading }: KPICardProps) => (
  <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group hover:-translate-y-1 transition-all duration-300">
    <div className={cn("h-1 w-full", accent.replace('bg-', 'bg-').replace('-50', '-500'))} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">
        {title}
      </CardTitle>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", accent)}>
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
            <div className={cn(
              "flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md",
              trend === "up" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {trend === "up" ? "12%" : "4%"}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{subtext}</span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hasTrackedLoadFailureRef = useRef(false);
  const {
    data: dashboardData,
    isLoading: loading,
    error: dashboardError,
    refetch: refetchDashboard,
    invalidate: invalidateDashboard,
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
  });
  const kpis = dashboardData?.kpis ?? null;
  const revenueData = dashboardData?.revenueData ?? [];
  const occupancyData = dashboardData?.occupancyData ?? [];
  const balance = dashboardData?.balance ?? null;
  const loadError = dashboardError ? "No se pudo cargar el dashboard. Reintentá." : null;

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

  const AlertItem = ({ alert, type }: { alert: any, type: 'arrival' | 'departure' }) => (
    <div 
      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group cursor-pointer"
      onClick={() => {
        setSelectedBookingId(alert.booking_id);
        setIsDrawerOpen(true);
      }}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          type === 'arrival' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
        )}>
          {type === 'arrival' ? <LogIn className="w-5 h-5" /> : <LogOutIcon className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-sm font-black text-slate-900 tracking-tight">{alert.guest_name}</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Habitación {alert.room_number}</div>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
        <MoreVertical className="w-4 h-4 text-slate-400" />
      </Button>
    </div>
  );

  const handleCloseCash = useCallback(async () => {
    if (!confirm("¿Deseas realizar el cierre de caja ahora? Se reseteará el balance para el próximo turno.")) return;
    setIsClosing(true);
    try {
      await closeCash("Cierre manual desde dashboard");
      trackUiEvent("close_cash_success", {
        total_amount_cents: balance?.total_amount_cents ?? 0,
      });
      toast({ title: "Caja cerrada", description: "El reporte ha sido generado correctamente", variant: "success" });
      invalidateDashboard();
      await refetchDashboard();
    } catch (e) {
      trackUiEvent("close_cash_failure", {
        message: getErrorMessage(e, "No se pudo cerrar la caja"),
      });
      toast({ title: "Error", description: "No se pudo cerrar la caja", variant: "error" });
    } finally {
      setIsClosing(false);
    }
  }, [balance?.total_amount_cents, invalidateDashboard, refetchDashboard, toast]);

  const handleDrawerSuccess = useCallback(async () => {
    invalidateDashboard();
    await refetchDashboard();
  }, [invalidateDashboard, refetchDashboard]);

  const formattedRevenueData = useMemo(
    () =>
      revenueData.map((item) => ({
        ...item,
        amount: item.amount_cents / 100,
        dateLabel: format(new Date(item.date), "dd/MM"),
      })),
    [revenueData],
  );

  const formattedOccupancyData = useMemo(
    () =>
      occupancyData.map((item) => ({
        ...item,
        rate: item.occupancy_rate,
        dateLabel: format(new Date(item.date), "dd/MM"),
      })),
    [occupancyData],
  );

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
            onClick={() => {
              trackUiEvent("dashboard_retry_clicked");
              void refetchDashboard();
            }}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {/* KPI GRID */}
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

      {/* CHARTS SECTION */}
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
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Ingreso']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#6366f1" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
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
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [`${value}%`, 'Ocupación']}
                  />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                    {formattedOccupancyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.rate > 80 ? '#6366f1' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* CASH CLOSURE WIDGET */}
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
                <p className="text-4xl font-black text-white">${((balance?.total_amount_cents || 0) / 100).toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Ingresos totales acumulados</p>
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
                onClick={handleCloseCash}
                disabled={isClosing || (balance?.total_amount_cents || 0) === 0}
                className="w-full h-12 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl"
              >
                {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar Turno y Cerrar Caja"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ALERTS SECTION */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Alertas de Hoy</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Llegadas y Salidas</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Check-ins ({kpis?.arrivals_today.length || 0})</span>
              {loading ? (
                Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : kpis?.arrivals_today.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">Sin llegadas hoy</div>
              ) : (
                kpis?.arrivals_today.map(a => <AlertItem key={a.booking_id} alert={a} type="arrival" />)
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Check-outs ({kpis?.departures_today.length || 0})</span>
              {loading ? (
                Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : kpis?.departures_today.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">Sin salidas hoy</div>
              ) : (
                kpis?.departures_today.map(a => <AlertItem key={a.booking_id} alert={a} type="departure" />)
              )}
            </div>
          </div>
        </div>

        {/* RECENT BOOKINGS */}
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
                  onClick={() => navigate("/bookings")}
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
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
};

export default DashboardHome;
