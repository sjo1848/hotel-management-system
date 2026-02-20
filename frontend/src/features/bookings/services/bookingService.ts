import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { Booking } from "@/types/domain";
import { toBooking, toBookings } from "@/types/contractMappers";

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
  const response = await apiPost<CreateBookingPayload, Booking>("/bookings", bookingData);
  return toBooking(response);
};

export const getBookings = async (start?: string, end?: string): Promise<Booking[]> => {
  const response = await apiGet<Booking[]>("/bookings", { start, end });
  return toBookings(response);
};

export const updateBooking = async (
  id: string,
  data: Partial<Pick<Booking, "guest_id" | "guest_name" | "check_in" | "check_out" | "status">>,
) => {
  const response = await apiPatch<typeof data, Booking>(`/bookings/${id}`, data);
  return toBooking(response);
};

const bookingService = {
    createBooking,
    getBookings,
    updateBooking,
};

export default bookingService;
