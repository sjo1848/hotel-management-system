import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SEVERITY_LABEL,
  type DashboardPriority,
  type DashboardPrioritySeverity,
} from "@/features/dashboard/utils/dashboardPriorities";

const SEVERITY_STYLES: Record<
  DashboardPrioritySeverity,
  { chip: string; icon: typeof AlertTriangle }
> = {
  high: { chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: ShieldAlert },
  medium: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200", icon: AlertTriangle },
  low: { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: Info },
};

type DashboardPriorityItemProps = {
  priority: DashboardPriority;
  index: number;
  canAct: boolean;
  onAction: (priority: DashboardPriority) => void;
};

const DashboardPriorityItem = ({ priority, index, canAct, onAction }: DashboardPriorityItemProps) => {
  const styles = SEVERITY_STYLES[priority.severity];
  const Icon = styles.icon;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black uppercase tracking-wider",
            styles.chip,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {SEVERITY_LABEL[priority.severity]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{priority.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{priority.description}</p>
        </div>
      </div>
      {canAct && priority.route ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full shrink-0 rounded-xl sm:w-auto sm:px-4"
          onClick={() => onAction(priority)}
        >
          {priority.actionLabel}
        </Button>
      ) : null}
      <span className="sr-only">Prioridad {index + 1}</span>
    </li>
  );
};

export default DashboardPriorityItem;
