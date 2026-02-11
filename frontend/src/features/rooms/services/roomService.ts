import client from "@/api/client";

export type Room = {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
  price_cents: number;
};

// Función individual
const getAllRooms = async (startDate?: string | null, endDate?: string | null) => {
  try {
    if (startDate && endDate) {
      const response = await client.get("/rooms/available", {
        params: {
          start: startDate,
          end: endDate,
        },
      });
      return response.data as Room[];
    }

    const response = await client.get("/rooms");
    return response.data as Room[];
  } catch (error) {
    console.error("Error fetching rooms:", error);
    throw error;
  }
};

const getRoomById = async (id: string) => {
  const response = await client.get(`/rooms/${id}`);
  return response.data as Room;
};

const updateRoomStatus = async (id: string, status: string) => {
  const response = await client.patch(`/rooms/${id}/status`, { status });
  return response.data;
};

// --- LA SOLUCIÓN ESTÁ AQUÍ ABAJO ---
// Agrupamos todo en un objeto y lo exportamos por defecto
const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
};

export default roomService;
