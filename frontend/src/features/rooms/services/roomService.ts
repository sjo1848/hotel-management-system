import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import { RoomStatus } from "@/types/domain";
import { toRoom, toRooms } from "@/types/contractMappers";
import type { components } from "@/api/generated/openapi";

type RoomContract = components["schemas"]["Room"];
type CreateRoomRequest = components["schemas"]["CreateRoomRequest"];

export const getAllRooms = async (startDate?: string | null, endDate?: string | null) => {
  const endpoint = (startDate && endDate) ? "/rooms/available" : "/rooms";
  const params = (startDate && endDate) ? { start: startDate, end: endDate } : undefined;
  const response = await apiGet<RoomContract[]>(endpoint, params);
  return toRooms(response);
};

export const getRoomById = async (id: string) => {
  const response = await apiGet<RoomContract>(`/rooms/${id}`);
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

export const createRoom = async (roomData: CreateRoomRequest) => {
  const response = await apiPost<CreateRoomRequest, RoomContract>("/rooms", roomData);
  return toRoom(response);
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  createRoom,
};

export default roomService;
