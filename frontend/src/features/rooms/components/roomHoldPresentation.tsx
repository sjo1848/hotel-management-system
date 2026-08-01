import type { RoomHoldType } from "@/types/domain";
import { Badge } from "@/components/ui/badge";

type HoldMeta = {
  label: string;
  description: string;
  className: string;
  color: string;
};

const HOLD_META: Record<RoomHoldType, HoldMeta> = {
  Vip: {
    label: "VIP",
    description: "Reserva estratégica para huésped prioritario.",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    color: "#c026d3",
  },
  Maintenance: {
    label: "Mantenimiento",
    description: "Intervención técnica programada.",
    className: "border-border bg-muted text-muted-foreground",
    color: "#475569",
  },
  Owner: {
    label: "Owner",
    description: "Uso interno o reserva del propietario.",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    color: "#d97706",
  },
  Compliance: {
    label: "Compliance",
    description: "Inspección, sanidad o control regulatorio.",
    className: "border-primary/20 bg-primary/10 text-primary",
    color: "#2563eb",
  },
  Commercial: {
    label: "Comercial",
    description: "Bloqueo comercial o cupo estratégico.",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    color: "#059669",
  },
  Other: {
    label: "Otro",
    description: "Retención operativa fuera de los casos estándar.",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
    color: "#52525b",
  },
};

export const ROOM_HOLD_TYPE_OPTIONS = (
  Object.keys(HOLD_META) as RoomHoldType[]
).map((value) => ({
  value,
  label: HOLD_META[value].label,
  description: HOLD_META[value].description,
}));

export const getRoomHoldMeta = (type: RoomHoldType) => {
  return HOLD_META[type] ?? HOLD_META.Commercial;
};

export const getRoomHoldBadge = (type: RoomHoldType) => {
  const meta = getRoomHoldMeta(type);
  return (
    <Badge className={meta.className} variant="outline">
      {meta.label}
    </Badge>
  );
};
