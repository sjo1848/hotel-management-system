import { Link2, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardPriorityItem from "./DashboardPriorityItem";
import type { DashboardPriority } from "@/features/dashboard/utils/dashboardPriorities";

type DashboardPriorityListProps = {
  priorities: DashboardPriority[];
  loading: boolean;
  hasCapability: (route?: string) => boolean;
  onAction: (priority: DashboardPriority) => void;
  onNavigateCalendar: () => void;
};

const DashboardPriorityList = ({
  priorities,
  loading,
  hasCapability,
  onAction,
  onNavigateCalendar,
}: DashboardPriorityListProps) => {
  const criticalCount = priorities.filter((priority) => priority.severity === "high").length;
  const canNavigateCalendar = hasCapability("/calendar");

  return (
    <section
      aria-label="Necesita atención"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Siren className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
            Necesita atención
          </h2>
        </div>
        {!loading && priorities.length > 0 ? (
          <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground md:hidden">
            {criticalCount > 0
              ? `${criticalCount} crítica${criticalCount === 1 ? "" : "s"}`
              : "Sin alertas críticas"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : priorities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/40 p-5">
          <p className="text-sm font-bold text-foreground">Operación estable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No hay alertas operativas con los datos disponibles.
          </p>
          {canNavigateCalendar ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 h-11 rounded-xl text-primary"
              onClick={onNavigateCalendar}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Ver calendario
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {priorities.map((priority, index) => (
            <DashboardPriorityItem
              key={priority.id}
              priority={priority}
              index={index}
              canAct={hasCapability(priority.route)}
              onAction={onAction}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

export default DashboardPriorityList;
