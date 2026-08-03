import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";

export type CalendarRange = { startDate: string; rangeDays: 7 | 14 | 30 };
export type CalendarAllocation =
  | { kind: "booking"; booking: Booking; startDate: string; endDate: string }
  | { kind: "hold"; hold: RoomHoldBoardEntry; startDate: string; endDate: string };

export type CalendarConflict = {
  roomId: string;
  date: string;
  allocations: CalendarAllocation[];
};

export type CalendarAgendaItem = CalendarAllocation & {
  room: Room;
  date: string;
  movement: "arrival" | "departure" | "stay" | "hold" | "conflict";
};

const ACTIVE_BOOKING_STATUSES = new Set(["Confirmed", "CheckedIn"]);

export const dateKeysForRange = ({ startDate, rangeDays }: CalendarRange) => {
  const start = parseISO(startDate);
  return eachDayOfInterval({ start, end: addDays(start, rangeDays - 1) }).map((date) =>
    format(date, "yyyy-MM-dd"),
  );
};

export const occupiesNight = (startDate: string, endDate: string, date: string) =>
  startDate <= date && date < endDate;

export const bookingIsVisible = (booking: Booking, includeInactive: boolean) =>
  includeInactive || ACTIVE_BOOKING_STATUSES.has(booking.status);

export const buildCalendarAllocations = (
  rooms: Room[],
  bookings: Booking[],
  holds: RoomHoldBoardEntry[],
  range: CalendarRange,
  includeInactive = false,
) => {
  const dates = dateKeysForRange(range);
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const allocationsByRoom = new Map<string, CalendarAllocation[]>();
  const allocationsByDate = new Map<string, CalendarAgendaItem[]>();

  const add = (allocation: CalendarAllocation) => {
    const roomId = allocation.kind === "booking" ? allocation.booking.room_id : allocation.hold.room_id;
    const room = roomById.get(roomId);
    if (!room) return;
    const roomAllocations = allocationsByRoom.get(roomId) ?? [];
    roomAllocations.push(allocation);
    allocationsByRoom.set(roomId, roomAllocations);
    dates.forEach((date) => {
      if (!occupiesNight(allocation.startDate, allocation.endDate, date)) return;
      const movement = allocation.kind === "hold"
        ? "hold"
        : allocation.booking.check_in === date
          ? "arrival"
          : "stay";
      const items = allocationsByDate.get(date) ?? [];
      items.push({ ...allocation, room, date, movement });
      allocationsByDate.set(date, items);
    });
  };

  bookings.filter((booking) => bookingIsVisible(booking, includeInactive)).forEach((booking) => {
    const allocation = { kind: "booking" as const, booking, startDate: booking.check_in, endDate: booking.check_out };
    add(allocation);
    if (dates.includes(booking.check_out) && roomById.has(booking.room_id)) {
      const items = allocationsByDate.get(booking.check_out) ?? [];
      items.push({ ...allocation, room: roomById.get(booking.room_id)!, date: booking.check_out, movement: "departure" });
      allocationsByDate.set(booking.check_out, items);
    }
  });
  holds.forEach((hold) => add({ kind: "hold", hold, startDate: hold.start_date, endDate: hold.end_date }));

  const conflicts: CalendarConflict[] = [];
  allocationsByRoom.forEach((allocations, roomId) => {
    dates.forEach((date) => {
      const active = allocations.filter((allocation) => occupiesNight(allocation.startDate, allocation.endDate, date));
      if (active.length > 1) conflicts.push({ roomId, date, allocations: active });
    });
  });

  return { dates, roomById, allocationsByRoom, allocationsByDate, conflicts };
};

export const calendarSummary = (
  model: ReturnType<typeof buildCalendarAllocations>,
  rooms: Room[],
) => {
  const bookings = [...model.allocationsByRoom.values()].flat().filter((item) => item.kind === "booking");
  const holds = [...model.allocationsByRoom.values()].flat().filter((item) => item.kind === "hold");
  const lastDate = model.dates[model.dates.length - 1];
  const arrivals = bookings.filter((item) => item.booking.check_in >= model.dates[0] && item.booking.check_in <= lastDate).length;
  const departures = bookings.filter((item) => item.booking.check_out > model.dates[0] && item.booking.check_out <= addDays(parseISO(lastDate), 1).toISOString().slice(0, 10)).length;
  return { bookings: bookings.length, arrivals, departures, holds: holds.length, conflicts: model.conflicts.length, rooms: rooms.length };
};
