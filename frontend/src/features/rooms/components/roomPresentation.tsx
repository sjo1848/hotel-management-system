import {
  CheckCircle,
  DoorClosed,
  SprayCan,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Room, RoomStatus } from "@/types/domain";

type RoomStatusMeta = {
  label: string;
  badgeVariant:
    | "success"
    | "destructive"
    | "warning"
    | "info"
    | "neutral"
    | "outline";
  icon: LucideIcon;
  accentClassName: string;
};

const ROOM_STATUS_META: Record<RoomStatus, RoomStatusMeta> = {
  Available: {
    label: "Disponible",
    badgeVariant: "success",
    icon: CheckCircle,
    accentClassName: "bg-primary",
  },
  Occupied: {
    label: "Ocupada",
    badgeVariant: "destructive",
    icon: User,
    accentClassName: "bg-red-500",
  },
  Dirty: {
    label: "Limpieza",
    badgeVariant: "warning",
    icon: SprayCan,
    accentClassName: "bg-amber-500",
  },
  Cleaning: {
    label: "En limpieza",
    badgeVariant: "info",
    icon: SprayCan,
    accentClassName: "bg-primary",
  },
  Maintenance: {
    label: "Mantenimiento",
    badgeVariant: "neutral",
    icon: Wrench,
    accentClassName: "bg-muted-foreground",
  },
};

export const getRoomStatusMeta = (status: RoomStatus): RoomStatusMeta =>
  ROOM_STATUS_META[status] ?? {
    label: status,
    badgeVariant: "outline",
    icon: DoorClosed,
    accentClassName: "bg-border",
  };

export const getRoomStatusBadge = (status: RoomStatus) => {
  const { label, badgeVariant, icon: Icon } = getRoomStatusMeta(status);
  return (
    <Badge variant={badgeVariant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

export const buildRoomStatusSummary = (rooms: Room[]) => ({
  total: rooms.length,
  available: rooms.filter((room) => room.status === "Available").length,
  occupied: rooms.filter((room) => room.status === "Occupied").length,
  dirty: rooms.filter((room) => room.status === "Dirty" || room.status === "Cleaning").length,
  maintenance: rooms.filter((room) => room.status === "Maintenance").length,
  avgRate:
    rooms.length > 0
      ? Math.round(rooms.reduce((sum, room) => sum + room.price_cents, 0) / rooms.length)
      : 0,
});
