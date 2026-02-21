import { useEffect, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type RevenuePoint = {
  dateLabel: string;
  amount: number;
};

type OccupancyPoint = {
  dateLabel: string;
  rate: number;
};

type DashboardChartsSectionProps = {
  loading: boolean;
  revenueData: RevenuePoint[];
  occupancyData: OccupancyPoint[];
};

const DashboardChartsSection = ({ loading, revenueData, occupancyData }: DashboardChartsSectionProps) => {
  const [isDarkSurface, setIsDarkSurface] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const syncTheme = () => setIsDarkSurface(root.classList.contains("dark"));
    syncTheme();

    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const axisTickColor = isDarkSurface ? "#cbd5e1" : "#64748b";
  const gridColor = isDarkSurface ? "#334155" : "#cbd5e1";
  const occupancyLowColor = isDarkSurface ? "#64748b" : "#94a3b8";
  const tooltipStyle =
    isDarkSurface
      ? {
          borderRadius: "16px",
          border: "1px solid rgb(51 65 85 / 0.8)",
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.45)",
          backgroundColor: "rgb(15 23 42 / 0.95)",
          color: "rgb(226 232 240)",
        }
      : { borderRadius: "16px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" };

  return (
    <div className="grid gap-8 md:grid-cols-2">
    <Card className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-200/60 dark:shadow-slate-950/40">
      <div className="mb-6 flex flex-col">
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Tendencia de Ingresos</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Últimos 30 días</p>
      </div>
      <div className="h-[250px] w-full">
        {loading ? (
          <Skeleton className="h-full w-full rounded-2xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 700 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toLocaleString()}`, "Ingreso"]}
              />
              <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>

    <Card className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-200/60 dark:shadow-slate-950/40">
      <div className="mb-6 flex flex-col">
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Tasa de Ocupación</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Ocupación diaria (%)</p>
      </div>
      <div className="h-[250px] w-full">
        {loading ? (
          <Skeleton className="h-full w-full rounded-2xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={occupancyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 700 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: axisTickColor, fontSize: 10, fontWeight: 700 }}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number | string | undefined) => [`${Number(value ?? 0)}%`, "Ocupación"]}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {occupancyData.map((entry, index) => (
                  <Cell key={`occ-${entry.dateLabel}-${index}`} fill={entry.rate > 80 ? "#6366f1" : occupancyLowColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
    </div>
  );
};

export default DashboardChartsSection;
