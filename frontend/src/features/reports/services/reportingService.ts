import client from "@/api/client";

export interface RevenueData {
    date: string;
    amount_cents: number;
}

interface RevenueDataRaw {
    date: string;
    amount_cents?: number;
    revenue_cents?: number;
}

export interface OccupancyData {
    date: string;
    occupied_rooms: number;
    total_rooms: number;
    occupancy_rate: number;
}

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueData[]> => {
    const response = await client.get<RevenueDataRaw[]>("/reports/revenue", { params: { start, end } });
    return (response.data ?? []).map((item) => ({
        date: item.date,
        amount_cents: item.amount_cents ?? item.revenue_cents ?? 0,
    }));
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
