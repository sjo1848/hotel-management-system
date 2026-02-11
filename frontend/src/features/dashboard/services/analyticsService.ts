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
};

export const getDashboardKpis = async (): Promise<DashboardKpis> => {
  const response = await client.get("/analytics/kpis");
  return response.data as DashboardKpis;
};
