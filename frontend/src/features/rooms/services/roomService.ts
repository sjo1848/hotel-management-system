import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
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
  const response = await apiPatch<{ status: string }, { status: string }>(`/rooms/${id}/status`, { status });
  emitDomainEvent("rooms.changed", { action: "status_updated", room_id: id });
  return response;
};

export const createRoom = async (roomData: { room_number: string, room_type: string, price_cents: number }) => {
  const room = await apiPost<typeof roomData, Room>("/rooms", roomData);
  emitDomainEvent("rooms.changed", { action: "created", room_id: room.id });
  return room;
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  createRoom,
};

export default roomService;
