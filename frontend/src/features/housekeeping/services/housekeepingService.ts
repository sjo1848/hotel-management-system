import { apiGet, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
import {
    HousekeepingBoard,
    MaintenanceCase,
    MarkMaintenanceInput,
    ResolveMaintenanceInput,
    Room,
} from "@/types/domain";

export const getDirtyRooms = async (): Promise<Room[]> => {
    return apiGet<Room[]>("/housekeeping/dirty");
};

export const startCleaning = async (roomId: string) => {
    const response = await apiPost<undefined, { status: string }>(`/housekeeping/${roomId}/start`, undefined);
    emitDomainEvent("rooms.changed", { action: "cleaning_started", room_id: roomId });
    return response;
};

export const finishCleaning = async (roomId: string) => {
    const response = await apiPost<undefined, { status: string }>(`/housekeeping/${roomId}/finish`, undefined);
    emitDomainEvent("rooms.changed", { action: "cleaning_finished", room_id: roomId });
    return response;
};

export const getHousekeepingBoard = async (date: string) => {
    return apiGet<HousekeepingBoard>("/housekeeping/board", { date });
};

export const sendRoomToMaintenance = async (roomId: string, payload: MarkMaintenanceInput) => {
    const response = await apiPost<MarkMaintenanceInput, MaintenanceCase>(`/housekeeping/${roomId}/maintenance`, payload);
    emitDomainEvent("rooms.changed", { action: "maintenance_flagged", room_id: roomId });
    return response;
};

export const returnRoomToDirty = async (roomId: string, payload: ResolveMaintenanceInput) => {
    const response = await apiPost<ResolveMaintenanceInput, MaintenanceCase>(`/housekeeping/${roomId}/dirty`, payload);
    emitDomainEvent("rooms.changed", { action: "dirty_requeued", room_id: roomId });
    return response;
};

const housekeepingService = {
    getDirtyRooms,
    getHousekeepingBoard,
    startCleaning,
    finishCleaning,
    sendRoomToMaintenance,
    returnRoomToDirty,
};

export default housekeepingService;
