import client from "@/api/client";

export const createBooking = async (bookingData) => {
  try {
    // bookingData debe tener: { room_id, guest_name, check_in, check_out, etc }
    const response = await client.post("/bookings", bookingData);
    return response.data;
  } catch (error) {
    console.error("Error creando reserva:", error);
    throw error.response?.data?.error || "Error al procesar la reserva";
  }
};

export const getBookings = async () => {
  const response = await client.get("/bookings");
  return response.data;
};

export const updateBooking = async (id, data) => {
  try {
    const response = await client.patch(`/bookings/${id}`, data);
    return response.data;
  } catch (error) {
    console.error("Error actualizando reserva:", error);
    throw error.response?.data?.error || "Error al actualizar la reserva";
  }
};
