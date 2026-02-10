import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

const TOAST_LIFETIME_MS = 3500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default" }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [
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
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-xl border shadow-lg bg-white p-4 animate-in fade-in slide-in-from-top-2",
              toast.variant === "success" && "border-emerald-200",
              toast.variant === "error" && "border-red-200",
            )}
          >
            <div className="text-sm font-semibold text-slate-900">
              {toast.title}
            </div>
            {toast.description ? (
              <div className="text-sm text-slate-600 mt-1">
                {toast.description}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-xs text-slate-400 hover:text-slate-600 mt-2"
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
