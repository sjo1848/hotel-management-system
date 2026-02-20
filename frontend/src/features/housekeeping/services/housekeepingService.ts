import { apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { Room } from "@/types/domain";
import { toRooms } from "@/types/contractMappers";

type RoomRaw = components["schemas"]["Room"];

export const getDirtyRooms = async (): Promise<Room[]> => {
    const response = await apiGet<RoomRaw[]>("/housekeeping/dirty");
    return toRooms(response);
};

export const startCleaning = async (roomId: string) => {
    return apiPost<Record<string, never>, Record<string, unknown>>(
      `/housekeeping/${roomId}/start`,
      {},
    );
};

export const finishCleaning = async (roomId: string) => {
    return apiPost<Record<string, never>, Record<string, unknown>>(
      `/housekeeping/${roomId}/finish`,
      {},
    );
};

const housekeepingService = {
    getDirtyRooms,
    startCleaning,
    finishCleaning,
};

export default housekeepingService;
