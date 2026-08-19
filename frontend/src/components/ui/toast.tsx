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
      <div role="status" aria-live="polite" aria-atomic="false" className="fixed left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-3 sm:left-auto sm:right-5 sm:top-5 sm:w-[320px]">
        {toasts.map((t: Toast) => (
          <div
            key={t.id}
            className={cn(
              "animate-in slide-in-from-top-2 fade-in rounded-2xl border bg-card/95 p-4 shadow-xl backdrop-blur-xl",
              t.variant === "success" && "border-emerald-500/20 bg-emerald-500/10",
              t.variant === "error" && "border-destructive/20 bg-destructive/10",
            )}
          >
            <div className="text-sm font-semibold text-foreground">
              {t.title}
            </div>
            {t.description ? (
              <div className="mt-1 text-sm text-muted-foreground">
                {t.description}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="mt-2 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
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
