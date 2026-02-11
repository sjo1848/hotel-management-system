import client from "@/api/client";

export interface RevenueData {
    date: string;
    revenue_cents: number;
}

export interface OccupancyData {
    date: string;
    occupied_rooms: number;
    total_rooms: number;
    occupancy_rate: number;
}

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueData[]> => {
    const response = await client.get("/reports/revenue", { params: { start, end } });
    return response.data;
};

export const getOccupancyReport = async (start?: string, end?: string): Promise<OccupancyData[]> => {
    const response = await client.get("/reports/occupancy", { params: { start, end } });
    return response.data;
};

const reportingService = {
    getRevenueReport,
    getOccupancyReport,
};

export default reportingService;
