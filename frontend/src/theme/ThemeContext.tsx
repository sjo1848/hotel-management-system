import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "balanced" | "dark";

const STORAGE_KEY = "hms-theme-mode";
const DEFAULT_THEME: ThemeMode = "balanced";
const THEMES: ThemeMode[] = ["light", "balanced", "dark"];

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "balanced", label: "Intermedio" },
  { value: "dark", label: "Oscuro" },
];

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const normalizeTheme = (value: string | null | undefined): ThemeMode => {
  if (!value) return DEFAULT_THEME;
  if (THEMES.includes(value as ThemeMode)) return value as ThemeMode;
  return DEFAULT_THEME;
};

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return normalizeTheme(window.localStorage.getItem(STORAGE_KEY));
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(resolveInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme === "dark" ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
