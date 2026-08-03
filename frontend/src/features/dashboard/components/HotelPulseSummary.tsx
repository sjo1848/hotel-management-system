import { BedDouble, CalendarCheck, DoorOpen, LogIn, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

type HotelPulseSummaryProps = {
  kpis: DashboardKpis | null;
  loading: boolean;
};

type PulseMetric = {
  id: string;
  label: string;
  context: string;
  icon: typeof DoorOpen;
  value: string;
};

const HotelPulseSummary = ({ kpis, loading }: HotelPulseSummaryProps) => {
  const metrics: PulseMetric[] = kpis
    ? [
        {
          id: "occupancy",
          label: "Ocupación",
          context: "Hoy",
          icon: DoorOpen,
          value: `${kpis.occupancy_rate.toFixed(1)}%`,
        },
        {
          id: "arrivals",
          label: "Llegadas",
          context: "Hoy",
          icon: LogIn,
          value: String(kpis.arrivals_today.length),
        },
        {
          id: "departures",
          label: "Salidas",
          context: "Hoy",
          icon: LogOut,
          value: String(kpis.departures_today.length),
        },
        {
          id: "active-bookings",
          label: "Reservas activas",
          context: "Total",
          icon: CalendarCheck,
          value: String(kpis.active_bookings_count),
        },
      ]
    : [];

  return (
    <section
      aria-label="Pulso del hotel"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <BedDouble className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
          Pulso del hotel
        </h3>
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : metrics.length === 0 ? null : (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.id}
                className="rounded-xl border border-border bg-muted/50 px-3 py-3"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {metric.label}
                  </dt>
                </div>
                <dd className="mt-1 text-xl font-black leading-none text-foreground">
                  {metric.value}
                </dd>
                <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                  {metric.context}
                </p>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
};

export default HotelPulseSummary;
