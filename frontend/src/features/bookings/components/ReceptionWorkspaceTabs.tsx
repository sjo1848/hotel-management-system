import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
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
  const tabRefs = useRef<Partial<Record<ReceptionWorkspaceView, HTMLButtonElement | null>>>({});
  const pendingFocusRef = useRef<ReceptionWorkspaceView | null>(null);

  useLayoutEffect(() => {
    if (pendingFocusRef.current) {
      const target = pendingFocusRef.current;
      pendingFocusRef.current = null;
      tabRefs.current[target]?.focus();
    }
  });

  const moveFocus = (view: ReceptionWorkspaceView) => {
    pendingFocusRef.current = view;
    onViewChange(view);
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
        ref={(node) => {
          tabRefs.current[view.id] = node;
        }}
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
    const baseVisibleViews = workspaceViews.slice(0, 3);
    const activeIsOverflow = !baseVisibleViews.some((view) => view.id === activeView);
    const visibleViews = activeIsOverflow
      ? [...baseVisibleViews.slice(0, 2), workspaceViews.find((view) => view.id === activeView)!]
      : baseVisibleViews;
    const overflowViews = workspaceViews.filter((view) => !visibleViews.some((visible) => visible.id === view.id));
    return (
      <div
        role="tablist"
        aria-label="Vistas de recepción"
        className="flex gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {visibleViews.map(renderTab)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Más vistas"
              className="min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold transition outline-none text-muted-foreground hover:bg-card/60 hover:text-foreground"
            >
              Más
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {overflowViews.map((view) => {
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
