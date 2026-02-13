import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { Booking } from "@/types/domain";

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
  return apiPost<CreateBookingPayload, Booking>("/bookings", bookingData);
};

export const getBookings = async (start?: string, end?: string): Promise<Booking[]> => {
  return apiGet<Booking[]>("/bookings", { start, end });
};

export const updateBooking = async (
  id: string,
  data: Partial<Pick<Booking, "guest_id" | "guest_name" | "check_in" | "check_out" | "status">>,
) => {
  return apiPatch<typeof data, Booking>(`/bookings/${id}`, data);
};

const bookingService = {
    createBooking,
    getBookings,
    updateBooking,
};

export default bookingService;
