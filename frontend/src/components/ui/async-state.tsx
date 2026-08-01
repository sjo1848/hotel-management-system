import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export const LoadingState = ({ label = "Cargando...", className }: LoadingStateProps) => (
  <div className={`flex items-center justify-center py-16 text-muted-foreground ${className ?? ""}`.trim()}>
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
    className={`flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/8 p-4 ${
      className ?? ""
    }`.trim()}
  >
    <p className="text-sm font-semibold text-destructive">{message}</p>
    {onRetry ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-lg border-destructive/20 bg-card text-destructive hover:bg-destructive/10"
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
    className={`rounded-xl border border-dashed border-border bg-muted/40 py-10 text-center text-sm font-semibold text-muted-foreground ${
      className ?? ""
    }`.trim()}
  >
    {message}
  </div>
);
