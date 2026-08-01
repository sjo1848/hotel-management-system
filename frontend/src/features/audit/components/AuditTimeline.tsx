import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  History,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionEyebrow } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import { useResourceQuery } from "@/lib/useResourceQuery";
import auditService from "@/features/audit/services/auditService";
import type { AuditEvent } from "@/types/domain";

type AuditTimelineProps = {
  title?: string;
  description?: string;
  entityIds: string[];
  enabled?: boolean;
  refreshSignal?: string | number;
  limit?: number;
  emptyMessage?: string;
  className?: string;
};

const getAuditMeta = (action: string) => {
  if (action.startsWith("Check-in:")) {
    return {
      label: "Check-in",
      variant: "success" as const,
      icon: CheckCircle2,
    };
  }

  if (action.startsWith("Check-out:")) {
    return {
      label: "Check-out",
      variant: "neutral" as const,
      icon: LogOut,
    };
  }

  if (action.startsWith("Room reassignment:")) {
    return {
      label: "Cambio habitacion",
      variant: "info" as const,
      icon: RefreshCw,
    };
  }

  if (action.startsWith("Cleaning")) {
    return {
      label: "Housekeeping",
      variant: "info" as const,
      icon: ClipboardList,
    };
  }

  if (action.includes("maintenance")) {
    return {
      label: "Mantenimiento",
      variant: "warning" as const,
      icon: ShieldAlert,
    };
  }

  if (action.startsWith("Cancellation:")) {
    return {
      label: "Cancelacion",
      variant: "destructive" as const,
      icon: AlertTriangle,
    };
  }

  return {
    label: "Actividad",
    variant: "outline" as const,
    icon: History,
  };
};

const formatActor = (event: AuditEvent) => {
  if (!event.user_id) return "Sistema";
  return `Usuario ${event.user_id.slice(0, 8).toUpperCase()}`;
};

const eventMatchesEntity = (event: AuditEvent, entityIds: string[]) => {
  return entityIds.some((entityId) => event.action.includes(entityId));
};

const AuditTimeline = ({
  title = "Auditoria operativa",
  description = "Eventos recientes vinculados a esta entidad.",
  entityIds,
  enabled = true,
  refreshSignal,
  limit = 80,
  emptyMessage = "Todavia no hay trazas visibles para esta entidad.",
  className,
}: AuditTimelineProps) => {
  const normalizedEntityIds = useMemo(
    () => entityIds.filter(Boolean),
    [entityIds],
  );
  const { data, isLoading, error, refetch } = useResourceQuery<AuditEvent[]>({
    queryKey: `audit:recent:${limit}`,
    queryFn: () => auditService.getAuditEvents(limit),
    enabled: enabled && normalizedEntityIds.length > 0,
    staleTimeMs: 0,
  });

  useEffect(() => {
    if (!enabled || normalizedEntityIds.length === 0) return;
    void refetch();
  }, [enabled, normalizedEntityIds.length, refetch, refreshSignal]);

  const relevantEvents = useMemo(
    () => (data ?? []).filter((event) => eventMatchesEntity(event, normalizedEntityIds)),
    [data, normalizedEntityIds],
  );

  return (
    <section className={cn("rounded-2xl border border-border bg-background/70 p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <SectionEyebrow className="text-foreground">{title}</SectionEyebrow>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl"
          onClick={() => {
            void refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No se pudo cargar la auditoria reciente. Reintenta en unos segundos.
        </div>
      ) : null}

      {!isLoading && !error && relevantEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}

      {!isLoading && !error && relevantEvents.length > 0 ? (
        <div className="space-y-3">
          {relevantEvents.map((event) => {
            const meta = getAuditMeta(event.action);
            const Icon = meta.icon;

            return (
              <div
                key={event.id}
                className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.variant} className="gap-1">
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatActor(event)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{event.action}</p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p>{format(new Date(event.created_at), "dd MMM yyyy", { locale: es })}</p>
                    <p className="mt-1">
                      {format(new Date(event.created_at), "HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default AuditTimeline;
