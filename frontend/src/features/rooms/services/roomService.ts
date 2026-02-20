import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { Room, RoomStatus } from "@/types/domain";
import { toRoom, toRooms } from "@/types/contractMappers";

export const getAllRooms = async (startDate?: string | null, endDate?: string | null) => {
  const endpoint = (startDate && endDate) ? "/rooms/available" : "/rooms";
  const params = (startDate && endDate) ? { start: startDate, end: endDate } : undefined;
  const response = await apiGet<Room[]>(endpoint, params);
  return toRooms(response);
};

export const getRoomById = async (id: string) => {
  const response = await apiGet<Room>(`/rooms/${id}`);
  return toRoom(response);
};

const toBackendRoomStatus = (status: RoomStatus | string): string => {
  const normalized = status.trim().toUpperCase();
  switch (normalized) {
    case "AVAILABLE":
    case "OCCUPIED":
    case "DIRTY":
    case "MAINTENANCE":
      return normalized;
    default:
      throw new Error(`Estado de habitación inválido para actualización: ${status}`);
  }
};

export const updateRoomStatus = async (id: string, status: RoomStatus | string) => {
  const backendStatus = toBackendRoomStatus(status);
  return apiPatch<{ status: string }, { status: string }>(`/rooms/${id}/status`, { status: backendStatus });
};

export const createRoom = async (roomData: { room_number: string, room_type: string, price_cents: number }) => {
  const response = await apiPost<typeof roomData, Room>("/rooms", roomData);
  return toRoom(response);
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  createRoom,
};

export default roomService;
