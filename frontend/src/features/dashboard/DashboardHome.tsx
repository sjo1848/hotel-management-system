import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Usando @
import {
  ArrowUpRight,
  ArrowDownRight,
  Users,
  DoorOpen,
  DollarSign,
  CalendarCheck,
} from "lucide-react";
// Aquí estaba el error. Usamos @ para ir directo a la fuente sin adivinar carpetas:
import BookingList from "@/features/bookings/components/BookingList";

type KPICardProps = {
  title: string;
  value: string;
  subtext: string;
  trend: "up" | "down";
  icon: React.ElementType;
  accent: string;
};

const KPICard = ({ title, value, subtext, trend, icon: Icon, accent }: KPICardProps) => (
  <Card className="border-slate-200 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-semibold text-slate-600">
        {title}
      </CardTitle>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon className="h-4 w-4 text-slate-700" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <p className="text-xs text-slate-600 mt-1 flex items-center">
        {trend === "up" ? (
          <span className="text-green-500 flex items-center font-medium mr-1">
            <ArrowUpRight className="w-3 h-3 mr-1" /> +12%
          </span>
        ) : (
          <span className="text-red-500 flex items-center font-medium mr-1">
            <ArrowDownRight className="w-3 h-3 mr-1" /> -4%
          </span>
        )}
        {subtext}
      </p>
    </CardContent>
  </Card>
);

const DashboardHome = () => {
  return (
    <div className="space-y-8">
      {/* KPI GRID - Los números grandes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Ingresos (Mes)"
          value="$14,200"
          subtext="vs mes pasado"
          trend="up"
          icon={DollarSign}
          accent="bg-emerald-50"
        />
        <KPICard
          title="Ocupación"
          value="82%"
          subtext="12 Habs. Libres"
          trend="up"
          icon={DoorOpen}
          accent="bg-sky-50"
        />
        <KPICard
          title="Check-ins Hoy"
          value="8"
          subtext="Pendientes"
          trend="down"
          icon={Users}
          accent="bg-amber-50"
        />
        <KPICard
          title="Reservas Activas"
          value="24"
          subtext="+3 última hora"
          trend="up"
          icon={CalendarCheck}
          accent="bg-indigo-50"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* RECENT BOOKINGS - Tu tabla insertada aquí */}
        <div className="col-span-7 border rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-slate-900">
                Últimas Reservas
              </h3>
              <p className="text-sm text-slate-500">
                Actividad reciente del hotel
              </p>
            </div>
          </div>
          <div className="p-0">
            <BookingList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
