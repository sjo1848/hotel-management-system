import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS, useTheme } from "./ThemeContext";

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

const ThemeToggle = ({ className, compact = false }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border bg-card/85 p-1 shadow-sm backdrop-blur-sm",
        className,
      )}
      role="radiogroup"
      aria-label="Selector de tema"
    >
      {THEME_OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "relative inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "min-w-8 px-2" : "min-w-20",
              active
                ? "bg-secondary text-secondary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {active && <Check className={cn("mr-1.5 h-3.5 w-3.5", compact && "mr-0")} />}
            {!compact && option.label}
            {compact && <span className="sr-only">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
