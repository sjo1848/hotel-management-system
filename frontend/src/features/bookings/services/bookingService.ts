import client from "@/api/client";

export type BookingStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "Cancelled";

export type Booking = {
  id: string;
  room_id: string;
  guest_id?: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
  total_price_cents: number;
  status: BookingStatus;
  created_at: string;
};

export type CreateBookingPayload = {
  room_id: string;
  guest_id?: string | null;
  guest_name: string;
  check_in: string;
  check_out: string;
};

export const createBooking = async (bookingData: CreateBookingPayload) => {
  try {
    // bookingData debe tener: { room_id, guest_name, check_in, check_out, etc }
    const response = await client.post("/bookings", bookingData);
    return response.data as Booking;
  } catch (error) {
    console.error("Error creando reserva:", error);
    const message =
      (error as { response?: { data?: { error?: string } } })?.response?.data
        ?.error || "Error al procesar la reserva";
    throw message;
  }
};

export const getBookings = async (startDate?: string, endDate?: string) => {
  const response = await client.get("/bookings", {
    params: {
      start: startDate,
      end: endDate,
    },
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
      (error as { response?: { data?: { error?: string } } })?.response?.data
        ?.error || "Error al actualizar la reserva";
    throw message;
  }
};
