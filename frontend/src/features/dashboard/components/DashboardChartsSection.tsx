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

const DashboardChartsSection = ({ loading, revenueData, occupancyData }: DashboardChartsSectionProps) => (
  <div className="grid gap-8 md:grid-cols-2">
    <Card className="overflow-hidden rounded-3xl border-none bg-white p-6 shadow-2xl shadow-slate-200/60">
      <div className="mb-6 flex flex-col">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Tendencia de Ingresos</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Últimos 30 días</p>
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
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toLocaleString()}`, "Ingreso"]}
              />
              <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>

    <Card className="overflow-hidden rounded-3xl border-none bg-white p-6 shadow-2xl shadow-slate-200/60">
      <div className="mb-6 flex flex-col">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Tasa de Ocupación</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Ocupación diaria (%)</p>
      </div>
      <div className="h-[250px] w-full">
        {loading ? (
          <Skeleton className="h-full w-full rounded-2xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={occupancyData}>
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
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                formatter={(value: number | string | undefined) => [`${Number(value ?? 0)}%`, "Ocupación"]}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {occupancyData.map((entry, index) => (
                  <Cell key={`occ-${entry.dateLabel}-${index}`} fill={entry.rate > 80 ? "#6366f1" : "#cbd5e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  </div>
);

export default DashboardChartsSection;
