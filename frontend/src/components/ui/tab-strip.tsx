import { useRef, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TabItem<T extends string> = { id: T; label: string };

export type TabStripProps<T extends string> = {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel: string;
  idPrefix: string;
  visible?: number;
};

export const TabStrip = <T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
  idPrefix,
  visible = 3,
}: TabStripProps<T>) => {
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: T) => {
    const index = tabs.findIndex((tab) => tab.id === current);
    let next: T | null = null;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next = tabs[(index + 1) % tabs.length].id;
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      next = tabs[(index - 1 + tabs.length) % tabs.length].id;
    } else if (event.key === "Home") {
      event.preventDefault();
      next = tabs[0].id;
    } else if (event.key === "End") {
      event.preventDefault();
      next = tabs[tabs.length - 1].id;
    }
    if (next && next !== current) {
      onTabChange(next);
      tabRefs.current[next]?.focus();
    }
  };

  const overflowTabs = tabs.slice(0, visible);
  const moreTabs = tabs.slice(visible);

  const renderTab = (tab: TabItem<T>, asMore = false) => {
    const active = tab.id === activeTab;
    return (
      <button
        key={tab.id}
        ref={(element) => {
          tabRefs.current[tab.id] = element;
        }}
        type="button"
        role="tab"
        id={`${idPrefix}-tab-${tab.id}`}
        aria-controls={`${idPrefix}-panel-${tab.id}`}
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        className={cn(
          "min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition",
          active
            ? "bg-card text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          asMore && "flex-1 sm:flex-none",
        )}
        onClick={() => onTabChange(tab.id)}
        onKeyDown={(event) => handleKeyDown(event, tab.id)}
      >
        {tab.label}
      </button>
    );
  };

  if (!isDesktop && moreTabs.length > 0) {
    const moreActiveTab = moreTabs.find((tab) => tab.id === activeTab);
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {overflowTabs.map((tab) => renderTab(tab))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              role="tab"
              aria-selected={!!moreActiveTab}
              className={cn(
                "min-h-11 flex-1 items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold transition outline-none",
                moreActiveTab
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              {moreActiveTab ? moreActiveTab.label : "Más"}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {moreTabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <DropdownMenuItem
                  key={tab.id}
                  role="tab"
                  id={`${idPrefix}-tab-${tab.id}`}
                  aria-selected={active}
                  className={cn(active && "bg-accent font-bold")}
                  onClick={() => onTabChange(tab.id)}
                >
                  {tab.label}
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
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-muted p-1"
    >
      {tabs.map((tab) => renderTab(tab))}
    </div>
  );
};
