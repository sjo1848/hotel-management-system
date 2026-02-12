import client from "@/api/client";
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
  try {
    const response = await client.post("/bookings", bookingData);
    return response.data as Booking;
  } catch (error) {
    console.error("Error creando reserva:", error);
    throw error;
  }
};

export const getBookings = async (start?: string, end?: string): Promise<Booking[]> => {
  const params = { start, end };
  const response = await client.get("/bookings", {
    params,
  });
  return response.data as Booking[];
};

export const updateBooking = async (
  id: string,
  data: Partial<Pick<Booking, "guest_id" | "guest_name" | "check_in" | "check_out" | "status">>,
) => {
  try {
    const response = await client.patch(`/bookings/${id}`, data);
    return response.data as Booking;
  } catch (error) {
    console.error("Error actualizando reserva:", error);
    throw error;
  }
};

const bookingService = {
    createBooking,
    getBookings,
    updateBooking,
};

export default bookingService;
