import type { RoomStatus } from "@/types/domain";

export type BulkTarget = "AVAILABLE" | "DIRTY";

export const BULK_TARGETS: Array<{ value: BulkTarget; label: string }> = [
  { value: "AVAILABLE", label: "Marcar disponibles" },
  { value: "DIRTY", label: "Enviar a limpieza" },
];

export const canApplyBulkTo = (target: BulkTarget) => (status: RoomStatus): boolean =>
  target === "AVAILABLE"
    ? status === "Cleaning" || status === "Available"
    : status === "Occupied" || status === "Dirty";

export const getStatusBreakdown = (statuses: RoomStatus[]): Record<RoomStatus, number> => {
  const breakdown: Record<RoomStatus, number> = {
    Available: 0,
    Occupied: 0,
    Dirty: 0,
    Cleaning: 0,
    Maintenance: 0,
  };
  for (const status of statuses) {
    breakdown[status] += 1;
  }
  return breakdown;
};

export const validateBulkSelection = (
  statuses: RoomStatus[],
  target: BulkTarget,
): { valid: boolean; blocking: RoomStatus[] } => {
  const blocking = Array.from(
    new Set(statuses.filter((status) => !canApplyBulkTo(target)(status))),
  );
  return { valid: blocking.length === 0, blocking };
};
