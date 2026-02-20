import { Check, Contrast, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Theme, useTheme } from "@/features/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "mid", label: "Intermedio", icon: Contrast },
  { value: "dark", label: "Oscuro", icon: Moon },
];

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon =
    resolvedTheme === "dark" ? Moon : resolvedTheme === "mid" ? Contrast : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className={cn(
            "rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
            className,
          )}
          aria-label="Cambiar tema"
        >
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </span>
            {theme === value && <Check className="h-4 w-4 text-secondary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
