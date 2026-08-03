import { apiDelete, apiGet, apiPatch, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
import { BulkRoomStatusUpdateResult, Room, RoomHold, RoomHoldBoardEntry } from "@/types/domain";

export type RoomUpsertPayload = {
  room_number: string;
  room_type: string;
  price_cents: number;
};

export type RoomHoldPayload = {
  start_date: string;
  end_date: string;
  hold_type: string;
  reason: string;
};

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

export const bulkUpdateRoomStatus = async (roomIds: string[], status: string) => {
  const response = await apiPost<
    { room_ids: string[]; status: string },
    BulkRoomStatusUpdateResult
  >("/rooms/bulk-status", { room_ids: roomIds, status });
  emitDomainEvent("rooms.changed", {
    action: "bulk_status_updated",
    room_ids: roomIds,
    status,
  });
  return response;
};

export const createRoom = async (roomData: RoomUpsertPayload) => {
  const room = await apiPost<typeof roomData, Room>("/rooms", roomData);
  emitDomainEvent("rooms.changed", { action: "created", room_id: room.id });
  return room;
};

export const updateRoom = async (id: string, roomData: RoomUpsertPayload) => {
  const room = await apiPatch<typeof roomData, Room>(`/rooms/${id}`, roomData);
  emitDomainEvent("rooms.changed", { action: "updated", room_id: room.id });
  return room;
};

export const getRoomHolds = async (id: string) => {
  return apiGet<RoomHold[]>(`/rooms/${id}/holds`);
};

export const getRoomHoldBoard = async (startDate: string, endDate: string) => {
  return apiGet<RoomHoldBoardEntry[]>("/rooms/holds/board", { start: startDate, end: endDate });
};

export const createRoomHold = async (id: string, holdData: RoomHoldPayload) => {
  const hold = await apiPost<typeof holdData, RoomHold>(`/rooms/${id}/holds`, holdData);
  emitDomainEvent("rooms.changed", { action: "hold_created", room_id: id, hold_id: hold.id });
  return hold;
};

export const updateRoomHold = async (roomId: string, holdId: string, holdData: RoomHoldPayload) => {
  const hold = await apiPatch<typeof holdData, RoomHold>(`/rooms/${roomId}/holds/${holdId}`, holdData);
  emitDomainEvent("rooms.changed", { action: "hold_updated", room_id: roomId, hold_id: hold.id });
  return hold;
};

export const deleteRoomHold = async (roomId: string, holdId: string) => {
  const response = await apiDelete<{ status: "ok" }>(`/rooms/${roomId}/holds/${holdId}`);
  emitDomainEvent("rooms.changed", { action: "hold_deleted", room_id: roomId, hold_id: holdId });
  return response;
};

const roomService = {
  getAllRooms,
  getRoomById,
  updateRoomStatus,
  bulkUpdateRoomStatus,
  createRoom,
  updateRoom,
  getRoomHolds,
  getRoomHoldBoard,
  createRoomHold,
  updateRoomHold,
  deleteRoomHold,
};

export default roomService;
