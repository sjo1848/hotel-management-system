import type { Booking, BookingStatus, Room, RoomStatus } from "@/types/domain";
import type { components } from "@/api/generated/openapi";

type BookingRaw = components["schemas"]["Booking"] & {
  hotel_id?: string;
  status?: string;
  guest_id?: string | null;
  room?: components["schemas"]["Room"];
};

type RoomRaw = components["schemas"]["Room"] & {
  hotel_id?: string;
  status?: string;
};

const normalizeBookingStatus = (status: string | undefined): BookingStatus => {
  const normalized = status?.trim().toUpperCase();
  switch (normalized) {
    case "CONFIRMED":
      return "Confirmed";
    case "CHECKEDIN":
    case "CHECKED_IN":
      return "CheckedIn";
    case "CHECKEDOUT":
    case "CHECKED_OUT":
      return "CheckedOut";
    case "CANCELLED":
    case "CANCELED":
      return "Cancelled";
    default:
      return "Confirmed";
  }
};

const normalizeRoomStatus = (status: string | undefined): RoomStatus => {
  const normalized = status?.trim().toUpperCase();
  switch (normalized) {
    case "AVAILABLE":
      return "Available";
    case "OCCUPIED":
      return "Occupied";
    case "DIRTY":
      return "Dirty";
    case "CLEANING":
      return "Cleaning";
    case "MAINTENANCE":
      return "Maintenance";
    default:
      return "Maintenance";
  }
};

export const toBooking = (raw: BookingRaw): Booking => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  room_id: raw.room_id ?? "",
  guest_id: raw.guest_id ?? null,
  guest_name: raw.guest_name ?? "",
  check_in: raw.check_in ?? "",
  check_out: raw.check_out ?? "",
  total_price_cents: raw.total_price_cents ?? 0,
  status: normalizeBookingStatus(raw.status),
  ...(raw.room ? { room: toRoom(raw.room) } : {}),
});

export const toBookings = (rawList: BookingRaw[] | undefined): Booking[] =>
  (rawList ?? []).map(toBooking);

export const toRoom = (raw: RoomRaw): Room => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  room_number: raw.room_number ?? "",
  room_type: raw.room_type ?? "",
  price_cents: raw.price_cents ?? 0,
  status: normalizeRoomStatus(raw.status),
});

export const toRooms = (rawList: RoomRaw[] | undefined): Room[] =>
  (rawList ?? []).map(toRoom);
