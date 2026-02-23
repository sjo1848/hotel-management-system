import client from "@/api/client";

export type BookingAlert = {
  booking_id: string;
  guest_name: string;
  room_number: string;
  status: string;
};

export type DashboardKpis = {
  revenue_month_cents: number;
  occupancy_rate: number;
  today_check_ins: number;
  active_bookings_count: number;
  arrivals_today: BookingAlert[];
  departures_today: BookingAlert[];
  rev_par_cents: number;
  adr_cents: number;
};

export type RevenueReportItem = {
  date: string;
  amount_cents: number;
};

export type OccupancyReportItem = {
  date: string;
  occupancy_rate: number;
};

export const getDashboardKpis = async (): Promise<DashboardKpis> => {
  const response = await client.get("/analytics/kpis");
  return response.data as DashboardKpis;
};

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueReportItem[]> => {
  const params = { start, end };
  const response = await client.get("/reports/revenue", { params });
  return response.data;
};

export const getOccupancyReport = async (start?: string, end?: string): Promise<OccupancyReportItem[]> => {
  const params = { start, end };
  const response = await client.get("/reports/occupancy", { params });
  return response.data;
};
