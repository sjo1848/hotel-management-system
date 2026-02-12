import { useEffect, useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Calendar as CalendarIcon,
    TrendingUp,
    BarChart3,
    Download
} from "lucide-react";
import { getRevenueReport, getOccupancyReport, RevenueData, OccupancyData } from "./services/reportingService";
import { useToast } from "@/components/ui/toast";
import { format, subDays } from "date-fns";

const ReportsPage = () => {
    const { toast } = useToast();
    const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
    const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const start = format(subDays(new Date(), 30), "yyyy-MM-dd");
            const end = format(new Date(), "yyyy-MM-dd");
            
            const [rev, occ] = await Promise.all([
                getRevenueReport(start, end),
                getOccupancyReport(start, end)
            ]);
            
            setRevenueData(rev);
            setOccupancyData(occ);
        } catch (error) {
            console.error("Failed to fetch reports", error);
            toast({ title: "Error", description: "No se pudieron cargar los reportes analíticos", variant: "error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString()}`;
    const formatDate = (dateStr: string) => format(new Date(dateStr), "dd MMM");

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                        Analítica Avanzada
                    </h2>
                    <p className="text-slate-500 font-medium mt-2">
                        Rendimiento financiero y métricas de ocupación.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="h-12 rounded-xl border-slate-200">
                        <CalendarIcon className="w-4 h-4 mr-2" /> Últimos 30 días
                    </Button>
                    <Button className="h-12 rounded-xl bg-slate-900 shadow-lg shadow-slate-200" onClick={() => toast({ title: "Exportación", description: "El módulo de PDF está en cola de desarrollo." })}>
                        <Download className="w-4 h-4 mr-2" /> Descargar PDF
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico de Ingresos */}
                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black text-slate-800">Ingresos Diarios</CardTitle>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Flujo de caja</p>
                        </div>
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full">
                            {loading ? (
                                <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="date" 
                                            tickFormatter={formatDate}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{fill: '#94a3b8', fontSize: 10}}
                                        />
                                        <YAxis 
                                            tickFormatter={(val) => `$${val/100}`}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{fill: '#94a3b8', fontSize: 10}}
                                        />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            formatter={(val: any) => [formatCurrency(Number(val)), "Ingresos"]}
                                            labelFormatter={(label: any) => formatDate(String(label))}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="amount_cents" 
                                            stroke="#10b981" 
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorRev)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Gráfico de Ocupación */}
                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black text-slate-800">Tasa de Ocupación</CardTitle>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Eficiencia de inventario</p>
                        </div>
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[300px] w-full">
                            {loading ? (
                                <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={occupancyData}>
                                        <defs>
                                            <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="date" 
                                            tickFormatter={formatDate}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{fill: '#94a3b8', fontSize: 10}}
                                        />
                                        <YAxis 
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{fill: '#94a3b8', fontSize: 10}}
                                            unit="%"
                                        />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            formatter={(val: any) => [`${Number(val).toFixed(1)}%`, "Ocupación"]}
                                            labelFormatter={(label: any) => formatDate(String(label))}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="occupancy_rate" 
                                            stroke="#6366f1" 
                                            strokeWidth={3}
                                            fillOpacity={1} 
                                            fill="url(#colorOcc)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;
