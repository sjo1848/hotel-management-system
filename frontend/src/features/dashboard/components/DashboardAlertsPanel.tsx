import { LogIn, LogOut as LogOutIcon, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

type DashboardAlertsPanelProps = {
  loading: boolean;
  kpis: DashboardKpis | null;
  onOpenBooking: (bookingId: string) => void;
};

type AlertType = "arrival" | "departure";

type AlertItem = {
  booking_id: string;
  guest_name: string;
  room_number: string;
};

type AlertCardProps = {
  alert: AlertItem;
  type: AlertType;
  onOpenBooking: (bookingId: string) => void;
};

const AlertCard = ({ alert, type, onOpenBooking }: AlertCardProps) => (
  <div
    className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md"
    onClick={() => onOpenBooking(alert.booking_id)}
  >
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          type === "arrival"
            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-200"
            : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-200",
        )}
      >
        {type === "arrival" ? <LogIn className="h-5 w-5" /> : <LogOutIcon className="h-5 w-5" />}
      </div>
      <div>
        <div className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">{alert.guest_name}</div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Habitación {alert.room_number}</div>
      </div>
    </div>
    <Button variant="ghost" size="icon" className="rounded-full opacity-0 transition-opacity group-hover:opacity-100 text-slate-500 dark:text-slate-300">
      <MoreVertical className="h-4 w-4 text-slate-400 dark:text-slate-500" />
    </Button>
  </div>
);

const renderAlertGroup = (
  title: string,
  count: number,
  loading: boolean,
  emptyLabel: string,
  alerts: AlertItem[],
  type: AlertType,
  onOpenBooking: (bookingId: string) => void,
) => (
  <div className="space-y-2">
    <span className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
      {title} ({count})
    </span>
    {loading ? (
      Array.from({ length: 2 }).map((_, i) => <Skeleton key={`${title}-sk-${i}`} className="h-16 w-full rounded-xl" />)
    ) : alerts.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
        {emptyLabel}
      </div>
    ) : (
      alerts.map((alert) => <AlertCard key={alert.booking_id} alert={alert} type={type} onOpenBooking={onOpenBooking} />)
    )}
  </div>
);

const DashboardAlertsPanel = ({ loading, kpis, onOpenBooking }: DashboardAlertsPanelProps) => {
  const arrivals = kpis?.arrivals_today ?? [];
  const departures = kpis?.departures_today ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">Alertas de Hoy</h3>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Llegadas y Salidas</p>
      </div>

      <div className="space-y-4">
        {renderAlertGroup("Check-ins", arrivals.length, loading, "Sin llegadas hoy", arrivals, "arrival", onOpenBooking)}
        {renderAlertGroup("Check-outs", departures.length, loading, "Sin salidas hoy", departures, "departure", onOpenBooking)}
      </div>
    </div>
  );
};

export default DashboardAlertsPanel;
