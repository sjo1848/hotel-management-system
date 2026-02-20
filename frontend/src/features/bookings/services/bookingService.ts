import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { Booking } from "@/types/domain";
import { toBooking, toBookings } from "@/types/contractMappers";
import type { components } from "@/api/generated/openapi";

type BookingContract = components["schemas"]["Booking"];
type CreateBookingRequest = components["schemas"]["CreateBookingRequest"];
type UpdateBookingRequest = components["schemas"]["UpdateBookingRequest"];

export type CreateBookingPayload = CreateBookingRequest & {
  guest_id?: string | null;
};

export type BookingFilterParams = {
  start?: string;
  end?: string;
};

export const createBooking = async (bookingData: CreateBookingPayload) => {
  const response = await apiPost<CreateBookingPayload, BookingContract>("/bookings", bookingData);
  return toBooking(response);
};

export const getBookings = async (start?: string, end?: string): Promise<Booking[]> => {
  const response = await apiGet<BookingContract[]>("/bookings", { start, end });
  return toBookings(response);
};

export const updateBooking = async (
  id: string,
  data: Partial<UpdateBookingRequest> & { guest_id?: string | null },
) => {
  const response = await apiPatch<typeof data, BookingContract>(`/bookings/${id}`, data);
  return toBooking(response);
};

const bookingService = {
    createBooking,
    getBookings,
    updateBooking,
};

export default bookingService;
