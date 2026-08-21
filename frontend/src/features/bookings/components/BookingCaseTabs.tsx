import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingCaseTab = "summary" | "operation" | "account" | "history";

export const bookingCaseTabs: Array<{ id: BookingCaseTab; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "operation", label: "Operación" },
  { id: "account", label: "Cuenta" },
  { id: "history", label: "Historial" },
];

type BookingCaseTabsProps = {
  activeTab: BookingCaseTab;
  onTabChange: (tab: BookingCaseTab) => void;
  operationCount?: number;
  accountAttention?: boolean;
  summary: ReactNode;
  operation: ReactNode;
  account: ReactNode;
  history: ReactNode;
  mobileTaskMode?: boolean;
};

export const BookingCaseTabs = ({
  activeTab,
  onTabChange,
  operationCount = 0,
  accountAttention = false,
  summary,
  operation,
  account,
  history,
  mobileTaskMode = false,
}: BookingCaseTabsProps) => {
  const [visitedTabs, setVisitedTabs] = useState<Set<BookingCaseTab>>(
    () => new Set([activeTab]),
  );
  const summaryPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisitedTabs((current) => {
      if (current.has(activeTab)) return current;
      return new Set([...current, activeTab]);
    });
  }, [activeTab]);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: BookingCaseTab) => {
    const index = bookingCaseTabs.findIndex((tab) => tab.id === current);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onTabChange(bookingCaseTabs[(index + 1) % bookingCaseTabs.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onTabChange(bookingCaseTabs[(index - 1 + bookingCaseTabs.length) % bookingCaseTabs.length].id);
    }
  };

  const panels: Array<{ id: BookingCaseTab; content: ReactNode }> = [
    { id: "summary", content: summary },
    { id: "operation", content: operation },
    { id: "account", content: account },
    { id: "history", content: history },
  ];
  return (
    <div className="space-y-4">
      {mobileTaskMode ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold text-primary md:hidden"
          onClick={() => {
            onTabChange("summary");
            window.setTimeout(() => summaryPanelRef.current?.focus(), 0);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al caso
        </button>
      ) : null}
      <div
        role="tablist"
        aria-label="Secciones del caso"
        className={cn(
          "grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted p-1 md:flex md:flex-wrap",
          mobileTaskMode && "hidden md:flex",
        )}
      >
        {bookingCaseTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`booking-case-tab-${tab.id}`}
              aria-controls={`booking-case-panel-${tab.id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={cn(
                "h-9 min-w-0 rounded-xl px-1 text-xs font-bold transition md:shrink-0 md:px-3 md:text-sm",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
            >
              {tab.label}{" "}
              {tab.id === "operation" && operationCount > 0 ? (
                <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300 md:ml-2">
                  {operationCount}
                </span>
              ) : null}
              {tab.id === "account" && accountAttention ? (
                <AlertCircle className="ml-2 inline h-3.5 w-3.5 text-destructive" />
              ) : null}
            </button>
          );
        })}
      </div>

      {panels.map((panel) =>
        visitedTabs.has(panel.id) || panel.id === activeTab ? (
          <div
            key={panel.id}
            ref={panel.id === "summary" ? summaryPanelRef : undefined}
            role="tabpanel"
            id={`booking-case-panel-${panel.id}`}
            aria-labelledby={`booking-case-tab-${panel.id}`}
            hidden={panel.id !== activeTab}
            tabIndex={panel.id === "summary" ? -1 : undefined}
            className="min-w-0 outline-none"
          >
            {panel.content}
          </div>
        ) : null,
      )}
    </div>
  );
};
