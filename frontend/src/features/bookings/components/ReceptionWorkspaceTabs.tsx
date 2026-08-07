import type { KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ReceptionWorkspaceView =
  | "shift"
  | "arrivals"
  | "in-house"
  | "departures"
  | "reservations";

export const workspaceViews: Array<{ id: ReceptionWorkspaceView; label: string }> = [
  { id: "shift", label: "Turno" },
  { id: "arrivals", label: "Llegadas" },
  { id: "in-house", label: "En casa" },
  { id: "departures", label: "Salidas" },
  { id: "reservations", label: "Reservas" },
];

type ReceptionWorkspaceTabsProps = {
  activeView: ReceptionWorkspaceView;
  counts: Record<ReceptionWorkspaceView, number>;
  onViewChange: (view: ReceptionWorkspaceView) => void;
  idBase?: string;
};

export const ReceptionWorkspaceTabs = ({
  activeView,
  counts,
  onViewChange,
  idBase = "reception-workspace",
}: ReceptionWorkspaceTabsProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const moveFocus = (view: ReceptionWorkspaceView) => {
    onViewChange(view);
    document.getElementById(`${idBase}-tab-${view}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: ReceptionWorkspaceView) => {
    const index = workspaceViews.findIndex((view) => view.id === current);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(workspaceViews[(index + 1) % workspaceViews.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(workspaceViews[(index - 1 + workspaceViews.length) % workspaceViews.length].id);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(workspaceViews[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(workspaceViews[workspaceViews.length - 1].id);
    }
  };

  const renderTab = (view: { id: ReceptionWorkspaceView; label: string }) => {
    const active = view.id === activeView;
    const count = counts[view.id];
    return (
      <button
        key={view.id}
        type="button"
        role="tab"
        id={`${idBase}-tab-${view.id}`}
        aria-controls={`${idBase}-panel-${view.id}`}
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className={cn(
          "min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold transition",
          active
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
        )}
        onClick={() => onViewChange(view.id)}
        onKeyDown={(event) => handleKeyDown(event, view.id)}
      >
        {view.label}{" "}
        {count > 0 ? (
          <span
            className={cn(
              "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-black",
              active ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    );
  };

  const moreViews = workspaceViews.slice(3);
  void moreViews;

  if (!isDesktop && workspaceViews.length > 3) {
    const overflowActive = workspaceViews.slice(3).find((view) => view.id === activeView);
    return (
      <div
        role="tablist"
        aria-label="Vistas de recepción"
        className="flex gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {workspaceViews.slice(0, 3).map(renderTab)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              role="tab"
              aria-selected={!!overflowActive}
              className={cn(
                "min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold transition outline-none",
                overflowActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              {overflowActive ? overflowActive.label : "Más"}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {workspaceViews.slice(3).map((view) => {
              const active = view.id === activeView;
              const count = counts[view.id];
              return (
                <DropdownMenuItem
                  key={view.id}
                  role="tab"
                  id={`${idBase}-tab-${view.id}`}
                  aria-selected={active}
                  className={cn(active && "bg-accent font-bold")}
                  onClick={() => onViewChange(view.id)}
                >
                  {view.label}
                  {count > 0 ? <span className="ml-2 font-black text-primary">{count}</span> : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Vistas de recepción"
      className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-muted p-1"
    >
      {workspaceViews.map(renderTab)}
    </div>
  );
};
