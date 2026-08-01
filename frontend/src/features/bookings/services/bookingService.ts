import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
import { Booking, BookingFrontDeskData, FrontDeskBoard } from "@/types/domain";

export type CreateBookingPayload = {
  room_id: string;
  guest_id?: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
};

export type BookingFilterParams = {
  start?: string;
  end?: string;
};

export const createBooking = async (bookingData: CreateBookingPayload) => {
  const booking = await apiPost<CreateBookingPayload, Booking>("/bookings", bookingData);
  emitDomainEvent("bookings.changed", { action: "created", booking_id: booking.id });
  return booking;
};

export const getBookings = async (start?: string, end?: string): Promise<Booking[]> => {
  return apiGet<Booking[]>("/bookings", { start, end });
};

export const getFrontDeskBoard = async (date?: string): Promise<FrontDeskBoard> => {
  return apiGet<FrontDeskBoard>("/front-desk/board", { date });
};

export const updateBooking = async (
  id: string,
  data: Partial<
    Pick<Booking, "guest_id" | "guest_name" | "room_id" | "check_in" | "check_out" | "status">
  > & {
    operational_note?: string;
    front_desk?: Partial<BookingFrontDeskData>;
  },
) => {
  const booking = await apiPatch<typeof data, Booking>(`/bookings/${id}`, data);
  emitDomainEvent("bookings.changed", { action: "updated", booking_id: id });
  return booking;
};

const bookingService = {
    createBooking,
    getBookings,
    getFrontDeskBoard,
    updateBooking,
};

export default bookingService;
