import client from "@/api/client";
import { Room } from "@/types/domain";

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

export const createRoom = async (roomData: { room_number: string, room_type: string, price_cents: number }) => {
  const response = await client.post("/rooms", roomData);
  return response.data as Room;
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  createRoom,
};

export default roomService;
