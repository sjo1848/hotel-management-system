import type { Booking, BookingStatus, Room, RoomStatus } from "@/types/domain";

type BookingRaw = Omit<Booking, "status" | "guest_id"> & {
  status?: string;
  guest_id?: string | null;
};

type RoomRaw = Omit<Room, "status"> & {
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
  ...raw,
  guest_id: raw.guest_id ?? null,
  status: normalizeBookingStatus(raw.status),
});

export const toBookings = (rawList: BookingRaw[] | undefined): Booking[] =>
  (rawList ?? []).map(toBooking);

export const toRoom = (raw: RoomRaw): Room => ({
  ...raw,
  status: normalizeRoomStatus(raw.status),
});

export const toRooms = (rawList: RoomRaw[] | undefined): Room[] =>
  (rawList ?? []).map(toRoom);

