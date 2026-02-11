import client from "@/api/client";

export type BookingStatus = "Confirmed" | "CheckedIn" | "CheckedOut" | "Cancelled";

export type Booking = {
  id: string;
  room_id: string;
  guest_id?: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
  total_price_cents: number;
  status: BookingStatus;
};

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
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || "Error al procesar la reserva";
    throw message;
  }
};

export const getBookings = async (params?: BookingFilterParams) => {
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
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || "Error al actualizar la reserva";
    throw message;
  }
};
