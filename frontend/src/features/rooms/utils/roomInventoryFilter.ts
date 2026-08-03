import type { Room, RoomStatus } from "@/types/domain";

export type InventoryStatusFilter = "all" | "available" | "occupied" | "cleaning" | "maintenance";

export const STATUS_FILTER_OPTIONS: Array<{ value: InventoryStatusFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "available", label: "Disponibles" },
  { value: "occupied", label: "Ocupadas" },
  { value: "cleaning", label: "Limpieza" },
  { value: "maintenance", label: "Mantenimiento" },
];

const CLEANING_STATUSES: RoomStatus[] = ["Dirty", "Cleaning"];

const statusMatchesFilter = (status: RoomStatus, filter: InventoryStatusFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "available":
      return status === "Available";
    case "occupied":
      return status === "Occupied";
    case "cleaning":
      return CLEANING_STATUSES.includes(status);
    case "maintenance":
      return status === "Maintenance";
  }
};

const STATUS_SEARCH_KEYWORDS: Array<{ keywords: string[]; matches: RoomStatus[] }> = [
  { keywords: ["disponible", "available"], matches: ["Available"] },
  { keywords: ["ocupad", "occupied"], matches: ["Occupied"] },
  { keywords: ["limpieza", "dirty", "cleaning"], matches: ["Dirty", "Cleaning"] },
  { keywords: ["mantenimiento", "maintenance"], matches: ["Maintenance"] },
];

export const normalizeSearchTerm = (term: string): string =>
  term
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const matchesSearchTerm = (room: Room, rawTerm: string): boolean => {
  const term = normalizeSearchTerm(rawTerm);
  if (!term) return true;

  if (normalizeSearchTerm(room.room_number).includes(term)) return true;
  if (normalizeSearchTerm(room.room_type).includes(term)) return true;

  const matchesStatusKeyword = term.length >= 3 && STATUS_SEARCH_KEYWORDS.some(
    (entry) =>
      entry.keywords.some(
        (keyword) => keyword.includes(term) || term.includes(keyword),
      ) && entry.matches.includes(room.status),
  );
  return matchesStatusKeyword;
};

export const filterRoomsByStatus = (rooms: Room[], filter: InventoryStatusFilter): Room[] =>
  rooms.filter((room) => statusMatchesFilter(room.status, filter));

export const filterRooms = (rooms: Room[], search: string, filter: InventoryStatusFilter): Room[] => {
  const byStatus = filterRoomsByStatus(rooms, filter);
  if (!normalizeSearchTerm(search)) return byStatus;
  return byStatus.filter((room) => matchesSearchTerm(room, search));
};

export type RoomStatusCounts = {
  total: number;
  available: number;
  occupied: number;
  cleaning: number;
  maintenance: number;
};

export const buildRoomStatusCounts = (rooms: Room[]): RoomStatusCounts => {
  let available = 0;
  let occupied = 0;
  let cleaning = 0;
  let maintenance = 0;
  for (const room of rooms) {
    switch (room.status) {
      case "Available":
        available += 1;
        break;
      case "Occupied":
        occupied += 1;
        break;
      case "Dirty":
      case "Cleaning":
        cleaning += 1;
        break;
      case "Maintenance":
        maintenance += 1;
        break;
    }
  }
  return { total: rooms.length, available, occupied, cleaning, maintenance };
};
