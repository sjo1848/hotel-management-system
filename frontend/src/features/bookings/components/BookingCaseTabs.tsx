import type { KeyboardEvent, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
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
}: BookingCaseTabsProps) => {
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
      <div
        role="tablist"
        aria-label="Secciones del caso"
        className="flex flex-wrap gap-1 rounded-2xl border border-border bg-muted p-1"
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
                "h-9 shrink-0 rounded-xl px-3 text-sm font-bold transition",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
            >
              {tab.label}{" "}
              {tab.id === "operation" && operationCount > 0 ? (
                <span className="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
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

      {panels.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          id={`booking-case-panel-${panel.id}`}
          aria-labelledby={`booking-case-tab-${panel.id}`}
          hidden={activeTab !== panel.id}
          className="min-w-0"
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
};
