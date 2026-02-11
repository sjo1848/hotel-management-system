import React, { useEffect, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, LineChart, Line, Legend
} from "recharts";
import {
    TrendingUp,
    Users,
    DollarSign,
    Calendar as CalendarIcon,
    Loader2,
    Download,
    Filter
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import reportingService, { RevenueData, OccupancyData } from "./services/reportingService";
import { useToast } from "@/components/ui/toast";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

const ReportsPage = () => {
    const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
    const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState(30);
    const { toast } = useToast();

    const loadReports = async () => {
        setLoading(true);
        try {
            const end = format(new Date(), "yyyy-MM-dd");
            const start = format(subDays(new Date(), range), "yyyy-MM-dd");

            const [rev, occ] = await Promise.all([
                reportingService.getRevenueReport(start, end),
                reportingService.getOccupancyReport(start, end)
            ]);

            setRevenueData(rev);
            setOccupancyData(occ);
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudieron cargar los reportes.",
                variant: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, [range]);

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
    };

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), "dd MMM", { locale: es });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase">Análisis & BI</h2>
                    <p className="text-slate-500 font-medium mt-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Tendencias de rendimiento y métricas operativas.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    {[7, 14, 30, 90].map((days) => (
                        <Button
                            key={days}
                            variant={range === days ? "secondary" : "ghost"}
                            size="sm"
                            className={`rounded-xl font-bold text-[11px] uppercase tracking-widest px-4 ${range === days ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                            onClick={() => setRange(days)}
                        >
                            {days} Días
                        </Button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-32 bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50">
                    <Loader2 className="animate-spin w-12 h-12 text-slate-400 mb-4" />
                    <p className="text-slate-400 font-bold tracking-widest uppercase text-[10px]">Cargando analíticas...</p>
                </div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Revenue Chart */}
                    <Card className="border-none rounded-[40px] shadow-2xl shadow-slate-200/60 overflow-hidden bg-white">
                        <CardHeader className="p-8 pb-2">
                            <div className="flex items-center justify-between">
                                <div className="bg-emerald-50 p-3 rounded-2xl">
                                    <DollarSign className="w-6 h-6 text-emerald-600" />
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <Download className="w-4 h-4 text-slate-400" />
                                </Button>
                            </div>
                            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight mt-4">Crecimiento de Ingresos</CardTitle>
                            <p className="text-slate-400 text-sm font-medium">Ingresos diarios acumulados por reservas.</p>
                        </CardHeader>
                        <CardContent className="p-8 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `€${val / 100}`}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        formatter={(val: number) => [formatCurrency(val), "Ingresos"]}
                                        labelFormatter={formatDate}
                                    />
                                    <Area type="monotone" dataKey="revenue_cents" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Occupancy Chart */}
                    <Card className="border-none rounded-[40px] shadow-2xl shadow-slate-200/60 overflow-hidden bg-white">
                        <CardHeader className="p-8 pb-2">
                            <div className="flex items-center justify-between">
                                <div className="bg-blue-50 p-3 rounded-2xl">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-full">
                                    <Download className="w-4 h-4 text-slate-400" />
                                </Button>
                            </div>
                            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight mt-4">Tasa de Ocupación</CardTitle>
                            <p className="text-slate-400 text-sm font-medium">Porcentaje de habitaciones vendidas sobre disponibilidad.</p>
                        </CardHeader>
                        <CardContent className="p-8 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={occupancyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        tickFormatter={(val) => `${val}%`}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        formatter={(val: number) => [`${val.toFixed(1)}%`, "Ocupación"]}
                                        labelFormatter={formatDate}
                                    />
                                    <Line type="stepAfter" dataKey="occupancy_rate" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ReportsPage;
