import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export const LoadingState = ({ label = "Cargando...", className }: LoadingStateProps) => (
  <div className={`flex items-center justify-center py-16 text-slate-500 ${className ?? ""}`.trim()}>
    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export const ErrorState = ({
  message,
  onRetry,
  retryLabel = "Reintentar",
  className,
}: ErrorStateProps) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 ${
      className ?? ""
    }`.trim()}
  >
    <p className="text-sm font-semibold text-rose-700">{message}</p>
    {onRetry ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
        onClick={onRetry}
      >
        {retryLabel}
      </Button>
    ) : null}
  </div>
);

type EmptyStateProps = {
  message: string;
  className?: string;
};

export const EmptyState = ({ message, className }: EmptyStateProps) => (
  <div
    className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm font-semibold text-slate-500 ${
      className ?? ""
    }`.trim()}
  >
    {message}
  </div>
);
