import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "mid" | "dark";
export type ResolvedTheme = Theme;

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "hms-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemeValue = (value: string | null): value is Theme =>
  value === "light" || value === "mid" || value === "dark";

const readStoredTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeValue(stored) ? stored : "light";
};

const applyThemeToDocument = (resolvedTheme: ResolvedTheme) => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.remove("dark", "theme-mid");

  if (resolvedTheme === "dark") {
    root.classList.add("dark");
  }

  if (resolvedTheme === "mid") {
    root.classList.add("dark", "theme-mid");
  }

  root.style.colorScheme = resolvedTheme === "light" ? "light" : "dark";
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const resolvedTheme = useMemo<ResolvedTheme>(() => theme, [theme]);

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    }
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () => {
        setTheme((currentTheme) => {
          if (currentTheme === "light") return "mid";
          if (currentTheme === "mid") return "dark";
          return "light";
        });
      },
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
