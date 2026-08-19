import type { KeyboardEvent, ReactNode } from "react";
import { CalendarDays, RefreshCw, Timer } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardTab = "operation" | "performance";

export const dashboardTabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "operation", label: "Operación" },
  { id: "performance", label: "Rendimiento" },
];

type DashboardControlCenterProps = {
  activeTab: DashboardTab;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  onTabChange: (tab: DashboardTab) => void;
  onRefresh: () => void;
  operationPanel: ReactNode;
  performancePanel: ReactNode;
};

const DashboardControlCenter = ({
  activeTab,
  isRefreshing,
  lastUpdated,
  onTabChange,
  onRefresh,
  operationPanel,
  performancePanel,
}: DashboardControlCenterProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: DashboardTab) => {
    const index = dashboardTabs.findIndex((tab) => tab.id === current);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onTabChange(dashboardTabs[(index + 1) % dashboardTabs.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onTabChange(dashboardTabs[(index - 1 + dashboardTabs.length) % dashboardTabs.length].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      onTabChange(dashboardTabs[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      onTabChange(dashboardTabs[dashboardTabs.length - 1].id);
    }
  };

  const panels: Array<{ id: DashboardTab; content: ReactNode }> = [
    { id: "operation", content: operationPanel },
    { id: "performance", content: performancePanel },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex items-center justify-between gap-3 md:items-end">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground md:text-2xl">Centro de control</h1>
          <p className="mt-1 hidden text-sm font-semibold text-muted-foreground md:block">
            Pulso operativo y rendimiento del hotel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs font-bold text-muted-foreground md:inline-flex">
            <CalendarDays className="h-4 w-4" />
            {format(new Date(), "d 'de' MMMM")}
          </span>
          <span className="hidden items-center gap-1.5 text-xs font-bold text-muted-foreground md:inline-flex">
            <Timer className="h-4 w-4" />
            {lastUpdated ? `Actualizado ${format(lastUpdated, "HH:mm")}` : "Sin actualizar"}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-11 rounded-xl px-3 md:px-4"
            aria-label={isRefreshing ? "Actualizando centro de control" : "Actualizar centro de control"}
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 md:mr-2", isRefreshing && "animate-spin")} />
            <span className="hidden md:inline">{isRefreshing ? "Actualizando…" : "Actualizar"}</span>
          </Button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Secciones del centro de control"
        className="flex w-fit gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {dashboardTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`dashboard-tab-${tab.id}`}
              aria-controls={`dashboard-panel-${tab.id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={cn(
                "h-11 min-w-[7.5rem] rounded-xl px-5 text-sm font-bold transition",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {isRefreshing ? "Actualizando…" : ""}
      </div>

      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          id={`dashboard-panel-${panel.id}`}
          aria-labelledby={`dashboard-tab-${panel.id}`}
          hidden={activeTab !== panel.id}
          className="min-w-0"
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
};

export default DashboardControlCenter;
