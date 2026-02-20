import { apiGet } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";

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
};

export type RevenueReportItem = {
  date: string;
  amount_cents: number;
};

type RevenueReportItemRaw = {
  date: string;
  amount_cents?: number;
  revenue_cents?: number;
};

type DashboardKpisRaw = components["schemas"]["DashboardKpis"];
type RevenueReportRaw = components["schemas"]["RevenueReport"];
type OccupancyReportRaw = components["schemas"]["OccupancyReport"];

const toBookingAlert = (
  raw: components["schemas"]["BookingAlert"],
): BookingAlert => ({
  booking_id: raw.booking_id,
  guest_name: raw.guest_name,
  room_number: raw.room_number,
  status: raw.status,
});

const toDashboardKpis = (raw: DashboardKpisRaw): DashboardKpis => ({
  revenue_month_cents: raw.revenue_month_cents ?? 0,
  occupancy_rate: raw.occupancy_rate ?? 0,
  today_check_ins: raw.today_check_ins ?? 0,
  active_bookings_count: raw.active_bookings_count ?? 0,
  arrivals_today: (raw.arrivals_today ?? []).map(toBookingAlert),
  departures_today: (raw.departures_today ?? []).map(toBookingAlert),
});

export type OccupancyReportItem = {
  date: string;
  occupancy_rate: number;
};

export const getDashboardKpis = async (): Promise<DashboardKpis> => {
  const response = await apiGet<DashboardKpisRaw>("/analytics/kpis");
  return toDashboardKpis(response);
};

export const getRevenueReport = async (start?: string, end?: string): Promise<RevenueReportItem[]> => {
  const params = { start, end };
  const response = await apiGet<Array<RevenueReportRaw | RevenueReportItemRaw>>(
    "/reports/revenue",
    params,
  );
  return (response ?? []).map((item) => ({
    date: item.date,
    amount_cents:
      ("amount_cents" in item ? item.amount_cents : undefined) ??
      ("revenue_cents" in item ? item.revenue_cents : undefined) ??
      0,
  }));
};

export const getOccupancyReport = async (start?: string, end?: string): Promise<OccupancyReportItem[]> => {
  const params = { start, end };
  const response = await apiGet<OccupancyReportRaw[]>("/reports/occupancy", params);
  return (response ?? []).map((item) => ({
    date: item.date,
    occupancy_rate: item.occupancy_rate ?? 0,
  }));
};
