import { apiGet } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";

type HotelNetworkSummaryRaw = components["schemas"]["HotelNetworkSummaryResponse"];
type HotelNetworkTotalsRaw = components["schemas"]["HotelNetworkTotals"];
type HotelNetworkBenchmarksRaw = components["schemas"]["HotelNetworkBenchmarks"];
type HotelNetworkHotelSummaryRaw = components["schemas"]["HotelNetworkHotelSummary"];

export type HotelNetworkFilters = {
  start?: string;
  end?: string;
  hotelId?: string;
};

export type HotelNetworkTotals = {
  hotels_count: number;
  revenue_cents: number;
  bookings_count: number;
  active_bookings_count: number;
  today_check_ins: number;
  avg_occupancy_rate: number;
  avg_adr_cents: number;
  avg_rev_par_cents: number;
};

export type HotelNetworkBenchmarks = {
  top_revenue_hotel_id: string | null;
  top_occupancy_hotel_id: string | null;
  top_rev_par_hotel_id: string | null;
};

export type HotelNetworkHotelSummary = {
  hotel_id: string;
  hotel_name: string;
  hotel_address: string | null;
  plan_tier: "BASIC" | "PRO" | "ENTERPRISE";
  revenue_cents: number;
  bookings_count: number;
  active_bookings_count: number;
  today_check_ins: number;
  occupancy_rate: number;
  adr_cents: number;
  rev_par_cents: number;
};

export type HotelNetworkSummary = {
  start: string;
  end: string;
  selected_hotel_id: string | null;
  totals: HotelNetworkTotals;
  benchmarks: HotelNetworkBenchmarks;
  hotels: HotelNetworkHotelSummary[];
};

const toTotals = (raw?: HotelNetworkTotalsRaw): HotelNetworkTotals => ({
  hotels_count: raw?.hotels_count ?? 0,
  revenue_cents: raw?.revenue_cents ?? 0,
  bookings_count: raw?.bookings_count ?? 0,
  active_bookings_count: raw?.active_bookings_count ?? 0,
  today_check_ins: raw?.today_check_ins ?? 0,
  avg_occupancy_rate: raw?.avg_occupancy_rate ?? 0,
  avg_adr_cents: raw?.avg_adr_cents ?? 0,
  avg_rev_par_cents: raw?.avg_rev_par_cents ?? 0,
});

const toBenchmarks = (raw?: HotelNetworkBenchmarksRaw): HotelNetworkBenchmarks => ({
  top_revenue_hotel_id: raw?.top_revenue_hotel_id ?? null,
  top_occupancy_hotel_id: raw?.top_occupancy_hotel_id ?? null,
  top_rev_par_hotel_id: raw?.top_rev_par_hotel_id ?? null,
});

const toHotelSummary = (raw: HotelNetworkHotelSummaryRaw): HotelNetworkHotelSummary => ({
  hotel_id: raw.hotel_id ?? "",
  hotel_name: raw.hotel_name ?? "",
  hotel_address: raw.hotel_address ?? null,
  plan_tier:
    (raw.plan_tier as HotelNetworkHotelSummary["plan_tier"] | undefined) ?? "BASIC",
  revenue_cents: raw.revenue_cents ?? 0,
  bookings_count: raw.bookings_count ?? 0,
  active_bookings_count: raw.active_bookings_count ?? 0,
  today_check_ins: raw.today_check_ins ?? 0,
  occupancy_rate: raw.occupancy_rate ?? 0,
  adr_cents: raw.adr_cents ?? 0,
  rev_par_cents: raw.rev_par_cents ?? 0,
});

const toNetworkSummary = (raw: HotelNetworkSummaryRaw): HotelNetworkSummary => ({
  start: raw.start ?? "",
  end: raw.end ?? "",
  selected_hotel_id: raw.selected_hotel_id ?? null,
  totals: toTotals(raw.totals),
  benchmarks: toBenchmarks(raw.benchmarks),
  hotels: (raw.hotels ?? []).map(toHotelSummary),
});

export const getHotelNetworkSummary = async (
  filters: HotelNetworkFilters = {},
): Promise<HotelNetworkSummary> => {
  const response = await apiGet<HotelNetworkSummaryRaw>("/hotels/network/summary", {
    start: filters.start,
    end: filters.end,
    hotel_id: filters.hotelId,
  });
  return toNetworkSummary(response);
};
