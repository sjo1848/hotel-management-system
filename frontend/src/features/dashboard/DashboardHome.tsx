import { useEffect, useState } from "react";
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

const DashboardHome = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueReportItem[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [kpiRes, revRes, occRes] = await Promise.all([
          getDashboardKpis(),
          getRevenueReport(),
          getOccupancyReport()
        ]);
        setKpis(kpiRes);
        setRevenueData(revRes);
        setOccupancyData(occRes);
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formattedRevenueData = revenueData.map(item => ({
    ...item,
    amount: item.amount_cents / 100,
    dateLabel: format(new Date(item.date), "dd/MM")
  }));

  const formattedOccupancyData = occupancyData.map(item => ({
    ...item,
    rate: item.occupancy_rate,
    dateLabel: format(new Date(item.date), "dd/MM")
  }));

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Vista General</h2>
        <p className="text-slate-500 font-medium mt-2">Estado operativo del hotel en tiempo real.</p>
      </div>

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
        {/* ALERTS SECTION */}
        <div className="lg:col-span-1 space-y-6">
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
        <div className="lg:col-span-2">
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
            <CardContent className="p-0">
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
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
};

export default DashboardHome;
