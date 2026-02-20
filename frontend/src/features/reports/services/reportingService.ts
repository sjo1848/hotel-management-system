import { apiGet } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";

export interface RevenueData {
    date: string;
    amount_cents: number;
}

interface RevenueDataRaw {
    date: string;
    amount_cents?: number;
    revenue_cents?: number;
}

type RevenueReportRaw = components["schemas"]["RevenueReport"];
type OccupancyReportRaw = components["schemas"]["OccupancyReport"];

export interface OccupancyData {
    date: string;
    occupied_rooms: number;
    total_rooms: number;
    occupancy_rate: number;
}

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueData[]> => {
    const response = await apiGet<Array<RevenueReportRaw | RevenueDataRaw>>("/reports/revenue", { start, end });
    return (response ?? []).map((item) => ({
        date: item.date,
        amount_cents:
            ("amount_cents" in item ? item.amount_cents : undefined) ??
            ("revenue_cents" in item ? item.revenue_cents : undefined) ??
            0,
    }));
};

export const getOccupancyReport = async (start?: string, end?: string): Promise<OccupancyData[]> => {
    const response = await apiGet<OccupancyReportRaw[]>("/reports/occupancy", { start, end });
    return (response ?? []).map((item) => ({
        date: item.date,
        occupied_rooms: item.occupied_rooms ?? 0,
        total_rooms: item.total_rooms ?? 0,
        occupancy_rate: item.occupancy_rate ?? 0,
    }));
};

const reportingService = {
    getRevenueReport,
    getOccupancyReport,
};

export default reportingService;
