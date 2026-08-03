import client from "@/api/client";

export interface RevenueData {
  date: string;
  revenue_cents?: number;
  amount_cents?: number;
}

export interface OccupancyData {
  date: string;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_rate: number;
}

export interface CashBalance {
  total_amount_cents: number;
  cash_amount_cents: number;
  card_amount_cents: number;
  payment_count: number;
  opening_time: string;
  pending_amount_cents: number;
  pending_bookings_count: number;
}

export interface CashClosure {
  id: string;
  hotel_id: string;
  user_id: string;
  total_amount_cents: number;
  cash_amount_cents: number;
  card_amount_cents: number;
  payment_count: number;
  counted_cash_amount_cents: number;
  cash_difference_cents: number;
  opening_time: string;
  closing_time: string;
  handoff_to: string;
  notes?: string | null;
}

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueData[]> => {
  const response = await client.get("/reports/revenue", { params: { start, end } });
  return response.data;
};

export const getOccupancyReport = async (start?: string, end?: string): Promise<OccupancyData[]> => {
  const response = await client.get("/reports/occupancy", { params: { start, end } });
  return response.data;
};

export const getCashBalance = async (): Promise<CashBalance> => {
  const response = await client.get("/billing/balance");
  return response.data;
};

export const getCashClosures = async (): Promise<CashClosure[]> => {
  const response = await client.get("/billing/closures");
  return response.data;
};

const reportingService = {
  getRevenueReport,
  getOccupancyReport,
  getCashBalance,
  getCashClosures,
};

export default reportingService;
