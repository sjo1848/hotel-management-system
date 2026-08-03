import { useEffect, useMemo, useState } from "react";
import { Check, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room, RoomStatus } from "@/types/domain";
import {
  BULK_TARGETS,
  getStatusBreakdown,
  validateBulkSelection,
  type BulkTarget,
} from "@/features/rooms/utils/roomBulkActions";

const STATUS_LABELS: Record<RoomStatus, string> = {
  Available: "Disponibles",
  Occupied: "Ocupadas",
  Dirty: "Pendientes de limpieza",
  Cleaning: "En limpieza",
  Maintenance: "Mantenimiento",
};

export type RoomBulkActionBarProps = {
  selectedRooms: Room[];
  outOfFilterCount: number;
  allVisibleSelected: boolean;
  visibleCount: number;
  busy: BulkTarget | null;
  onApply: (target: BulkTarget) => void;
  onSelectVisible: () => void;
  onClear: () => void;
};

export const RoomBulkActionBar = ({
  selectedRooms,
  outOfFilterCount,
  allVisibleSelected,
  visibleCount,
  busy,
  onApply,
  onSelectVisible,
  onClear,
}: RoomBulkActionBarProps) => {
  const [pendingTarget, setPendingTarget] = useState<BulkTarget | null>(null);

  const statuses = useMemo(() => selectedRooms.map((room) => room.status), [selectedRooms]);
  const breakdown = useMemo(() => getStatusBreakdown(statuses), [statuses]);
  const validation = useMemo(
    () => ({
      AVAILABLE: validateBulkSelection(statuses, "AVAILABLE"),
      DIRTY: validateBulkSelection(statuses, "DIRTY"),
    }),
    [statuses],
  );

  const allBlocking = useMemo(
    () =>
      Array.from(
        new Set([...validation.AVAILABLE.blocking, ...validation.DIRTY.blocking]),
      ),
    [validation],
  );

  useEffect(() => {
    if (pendingTarget && !validation[pendingTarget].valid) {
      setPendingTarget(null);
    }
  }, [pendingTarget, validation]);

  const pending = pendingTarget ? BULK_TARGETS.find((t) => t.value === pendingTarget) : null;
  const cleaningCount = breakdown.Dirty + breakdown.Cleaning;

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
            Acción masiva
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-black text-foreground">
              {selectedRooms.length} habitaciones seleccionadas
            </p>
            {outOfFilterCount > 0 ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {outOfFilterCount} fuera del filtro
              </span>
            ) : null}
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              Disp. {breakdown.Available}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              Ocupadas {breakdown.Occupied}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              Limpieza {cleaningCount}
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              Mant. {breakdown.Maintenance}
            </span>
          </div>
          {allBlocking.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Bloquean: {allBlocking.map((status) => STATUS_LABELS[status]).join(" · ")}.
              <span className="ml-1 font-semibold text-foreground">
                El backend valida el lote completo.
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              El lote es válido para ambas transiciones. Se aplica sobre el conjunto
              completo, no por partes.
            </p>
          )}
        </div>

        {pending ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">
                ¿Aplicar «{pending.label}» a {selectedRooms.length} habitaciones?
              </span>
            </div>
            <Button
              className="h-10 rounded-xl"
              disabled={busy !== null}
              onClick={() => onApply(pending.value)}
            >
              {busy === pending.value ? (
                <Check className="h-4 w-4 animate-pulse" />
              ) : null}
              {busy === pending.value ? "Aplicando..." : "Confirmar"}
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-xl"
              disabled={busy !== null}
              onClick={() => setPendingTarget(null)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
            {BULK_TARGETS.map((target) => {
              const valid = validation[target.value].valid;
              return (
                <Button
                  key={target.value}
                  variant="outline"
                  className="h-10 rounded-xl"
                  disabled={busy !== null || !valid}
                  onClick={() => setPendingTarget(target.value)}
                >
                  {target.label}
                </Button>
              );
            })}
            {outOfFilterCount > 0 ? (
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                disabled={allVisibleSelected || busy !== null}
                onClick={onSelectVisible}
              >
                Seleccionar visibles ({visibleCount})
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="h-10 rounded-xl"
              disabled={busy !== null}
              onClick={onClear}
            >
              <X className="h-4 w-4" />
              Limpiar selección
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
