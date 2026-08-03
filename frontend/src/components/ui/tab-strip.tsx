import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { id: T; label: string };

export type TabStripProps<T extends string> = {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel: string;
  idPrefix: string;
};

export const TabStrip = <T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
  idPrefix,
}: TabStripProps<T>) => {
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

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

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-muted p-1"
    >
      {tabs.map((tab) => {
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
              "h-10 shrink-0 rounded-xl px-4 text-sm font-bold transition",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
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
  );
};
