import client from "@/api/client";
import { emitDomainEvent } from "@/lib/domainEvents";
import { Hotel } from "@/types/domain";

export type HotelNetworkKpi = {
  hotel_id: string;
  hotel_name: string;
  plan_tier: "BASIC" | "PRO" | "ENTERPRISE";
  occupancy_rate: number;
  active_bookings_count: number;
  revenue_cents: number;
  adr_cents: number;
  rev_par_cents: number;
};

export type HotelNetworkSummary = {
  start: string;
  end: string;
  total_hotels: number;
  total_active_bookings: number;
  total_revenue_cents: number;
  average_occupancy_rate: number;
  hotels: HotelNetworkKpi[];
};

export type TenantFeatureFlags = {
  hotel_id: string;
  plan_tier: "BASIC" | "PRO" | "ENTERPRISE";
  automation_alerts_enabled: boolean;
  pricing_assistant_enabled: boolean;
  hq_benchmark_enabled: boolean;
  advanced_analytics_enabled: boolean;
};

export const getHotels = async () => {
  const response = await client.get("/hotels");
  return response.data as Hotel[];
};

export const getHotelNetworkKpis = async (start?: string, end?: string) => {
  const response = await client.get("/hotels/network-kpis", {
    params: { start, end },
  });
  return response.data as HotelNetworkSummary;
};

export const getFeatureFlags = async () => {
  const response = await client.get("/feature-flags");
  return response.data as TenantFeatureFlags;
};

export const updateHotelPlanTier = async (
  hotelId: string,
  planTier: "BASIC" | "PRO" | "ENTERPRISE",
) => {
  const response = await client.patch(`/hotels/${hotelId}/plan`, {
    plan_tier: planTier,
  });
  const flags = response.data as TenantFeatureFlags;
  emitDomainEvent("hotels.changed", { action: "plan_updated", hotel_id: hotelId, plan_tier: planTier });
  return flags;
};

export const createHotel = async (hotelData: { name: string, address?: string }) => {
  const response = await client.post("/hotels", hotelData);
  const hotel = response.data as Hotel;
  emitDomainEvent("hotels.changed", { action: "created", hotel_id: hotel.id });
  return hotel;
};

const hotelService = {
  getHotels,
  getHotelNetworkKpis,
  getFeatureFlags,
  updateHotelPlanTier,
  createHotel,
};

export default hotelService;
