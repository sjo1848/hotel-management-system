import client from "@/api/client";

export type Room = {
  id: string;
  room_number: string;
  room_type: string;
  status: "Available" | "Occupied" | "Dirty" | "Cleaning" | "Maintenance";
  price_cents: number;
};

export const getAllRooms = async (startDate?: string | null, endDate?: string | null) => {
  try {
    const config = {
      params: (startDate && endDate) ? { start: startDate, end: endDate } : undefined
    };

    const endpoint = (startDate && endDate) ? "/rooms/available" : "/rooms";

    const response = await client.get(endpoint, config);
    return response.data as Room[];
  } catch (error) {
    console.error("Error fetching rooms:", error);
    throw error;
  }
};

export const getRoomById = async (id: string) => {
  const response = await client.get(`/rooms/${id}`);
  return response.data as Room;
};

export const updateRoomStatus = async (id: string, status: string) => {
  const response = await client.patch(`/rooms/${id}/status`, { status });
  return response.data;
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
};

export default roomService;
