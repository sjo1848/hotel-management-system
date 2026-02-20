import client from "@/api/client";
import { Room } from "@/types/domain";
import { toRooms } from "@/types/contractMappers";

export const getDirtyRooms = async (): Promise<Room[]> => {
    const response = await client.get<Room[]>("/housekeeping/dirty");
    return toRooms(response.data);
};

export const startCleaning = async (roomId: string) => {
    const response = await client.post(`/housekeeping/${roomId}/start`);
    return response.data;
};

export const finishCleaning = async (roomId: string) => {
    const response = await client.post(`/housekeeping/${roomId}/finish`);
    return response.data;
};

const housekeepingService = {
    getDirtyRooms,
    startCleaning,
    finishCleaning,
};

export default housekeepingService;
