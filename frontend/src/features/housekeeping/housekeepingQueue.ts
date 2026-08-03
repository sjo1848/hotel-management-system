import type { HousekeepingBoardRoom, HousekeepingDeparture } from "@/types/domain";

export type HousekeepingFilter = "shift" | "dirty" | "cleaning" | "available" | "maintenance";

export type HousekeepingQueueItem = HousekeepingBoardRoom & {
  priorityRank: number;
  isBlocked: boolean;
  isOrphanDeparture: boolean;
  departure?: HousekeepingDeparture;
};

const maintenanceRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 } as const;

export const operationalDate = (now = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildHousekeepingQueue = (rooms: HousekeepingBoardRoom[], departures: HousekeepingDeparture[]) => {
  const departureByRoom = new Map(departures.map((departure) => [departure.room_id, departure]));
  const queue: HousekeepingQueueItem[] = rooms.map((room): HousekeepingQueueItem => {
    const departure = departureByRoom.get(room.room_id);
    const isBlocked = Boolean(departure && departure.booking_status === "CheckedIn") || room.room_status === "Maintenance";
    const priorityRank = room.maintenance_case
      ? maintenanceRank[room.maintenance_case.priority]
      : room.room_status === "Dirty" && room.turnover_today
        ? 2
        : room.room_status === "Cleaning" && room.turnover_today
          ? 3
          : isBlocked
            ? 4
            : room.room_status === "Dirty"
              ? 5
              : room.room_status === "Cleaning"
                ? 6
                : room.room_status === "Maintenance"
                  ? 7
                  : 8;
    return { ...room, departure, isBlocked, isOrphanDeparture: false, priorityRank };
  });
  const roomIds = new Set(rooms.map((room) => room.room_id));
  for (const departure of departures) {
    if (!roomIds.has(departure.room_id)) {
      queue.push({ room_id: `departure:${departure.booking_id}`, room_number: departure.room_number, room_type: departure.room_type, room_status: departure.room_status, turnover_today: true, departure_guest_name: departure.guest_name, departure_booking_status: departure.booking_status, departure, isBlocked: true, isOrphanDeparture: true, priorityRank: 4 });
    }
  }
  return queue.sort((left, right) => left.priorityRank - right.priorityRank || left.room_number.localeCompare(right.room_number, "es", { numeric: true }));
};

export const filterHousekeepingQueue = (queue: HousekeepingQueueItem[], filter: HousekeepingFilter, search: string) => {
  const term = search.trim().toLocaleLowerCase();
  return queue.filter((room) => {
    const filterMatch = filter === "shift"
      || (filter === "dirty" && room.room_status === "Dirty")
      || (filter === "cleaning" && room.room_status === "Cleaning")
      || (filter === "available" && room.room_status === "Available")
      || (filter === "maintenance" && room.room_status === "Maintenance");
    if (!filterMatch) return false;
    if (!term) return true;
    return `${room.room_number} ${room.room_type} ${room.room_status} ${room.departure?.guest_name ?? room.departure_guest_name ?? ""}`.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  });
};
