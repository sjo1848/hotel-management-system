import client from "@/api/client";
import { Room } from "@/types/domain";

export const getDirtyRooms = async (): Promise<Room[]> => {
    const response = await client.get("/housekeeping/dirty");
    return response.data as Room[];
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
