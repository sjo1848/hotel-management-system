import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { Room } from "@/types/domain";

export const getAllRooms = async (startDate?: string | null, endDate?: string | null) => {
  const endpoint = (startDate && endDate) ? "/rooms/available" : "/rooms";
  const params = (startDate && endDate) ? { start: startDate, end: endDate } : undefined;
  return apiGet<Room[]>(endpoint, params);
};

export const getRoomById = async (id: string) => {
  return apiGet<Room>(`/rooms/${id}`);
};

export const updateRoomStatus = async (id: string, status: string) => {
  return apiPatch<{ status: string }, { status: string }>(`/rooms/${id}/status`, { status });
};

export const createRoom = async (roomData: { room_number: string, room_type: string, price_cents: number }) => {
  return apiPost<typeof roomData, Room>("/rooms", roomData);
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  createRoom,
};

export default roomService;
