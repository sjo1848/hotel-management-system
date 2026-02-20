import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export type ToastContextType = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const TOAST_LIFETIME_MS = 3500;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    setToasts((current: Toast[]) => current.filter((t: Toast) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default" }: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current: Toast[]) => [
        ...current,
        { id, title, description, variant },
      ]);
      const timer = setTimeout(() => removeToast(id), TOAST_LIFETIME_MS);
      timers.current.set(id, timer);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-[320px]">
        {toasts.map((t: Toast) => (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border shadow-lg bg-white dark:bg-slate-900 p-4 animate-in fade-in slide-in-from-top-2",
              t.variant === "success" &&
                "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
              t.variant === "error" &&
                "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30",
            )}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.title}
            </div>
            {t.description ? (
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {t.description}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 mt-2"
            >
              Cerrar
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
