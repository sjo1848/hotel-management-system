import client from "@/api/client";

export const createBooking = async (bookingData) => {
  try {
    // bookingData debe tener: { room_id, guest_name, start_date, end_date, etc }
    const response = await client.post("/bookings", bookingData);
    return response.data;
  } catch (error) {
    console.error("Error creando reserva:", error);
    throw error.response?.data?.error || "Error al procesar la reserva";
  }
};
