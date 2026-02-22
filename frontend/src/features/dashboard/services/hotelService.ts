import { apiGet, apiPatch, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { Hotel } from "@/types/domain";

type HotelRaw = components["schemas"]["Hotel"];
type CreateHotelRequest = components["schemas"]["CreateHotelRequest"];
type UpdateHotelPlanTierRequest = components["schemas"]["UpdateHotelPlanTierRequest"];
type UpdateHotelPlanTierResponse = components["schemas"]["UpdateHotelPlanTierResponse"];
type PlanFeatureFlagsRaw = components["schemas"]["PlanFeatureFlags"];

export type PlanFeatureFlags = {
  revenue_cockpit: boolean;
  housekeeping_sla_alerts: boolean;
  pricing_assistant: boolean;
  exception_notifications: boolean;
  hq_multi_property: boolean;
  benchmarking_exports: boolean;
  pricing_rules_automation: boolean;
};

const toHotel = (raw: HotelRaw): Hotel => ({
  id: raw.id ?? "",
  name: raw.name ?? "",
  address: raw.address ?? undefined,
  plan_tier: (raw.plan_tier as Hotel["plan_tier"] | undefined) ?? "BASIC",
});

const toPlanFeatureFlags = (raw?: PlanFeatureFlagsRaw): PlanFeatureFlags => ({
  revenue_cockpit: raw?.revenue_cockpit ?? false,
  housekeeping_sla_alerts: raw?.housekeeping_sla_alerts ?? false,
  pricing_assistant: raw?.pricing_assistant ?? false,
  exception_notifications: raw?.exception_notifications ?? false,
  hq_multi_property: raw?.hq_multi_property ?? false,
  benchmarking_exports: raw?.benchmarking_exports ?? false,
  pricing_rules_automation: raw?.pricing_rules_automation ?? false,
});

export const getHotels = async () => {
  const response = await apiGet<HotelRaw[]>("/hotels");
  return (response ?? []).map(toHotel);
};

export const createHotel = async (hotelData: CreateHotelRequest) => {
  const response = await apiPost<CreateHotelRequest, HotelRaw>("/hotels", hotelData);
  return toHotel(response);
};

export const updateHotelPlanTier = async (
  hotelId: string,
  planTier: Hotel["plan_tier"],
) => {
  const payload: UpdateHotelPlanTierRequest = { plan_tier: planTier };
  const response = await apiPatch<
    UpdateHotelPlanTierRequest,
    UpdateHotelPlanTierResponse
  >(`/hotels/${hotelId}/plan`, payload);

  return {
    hotel: toHotel((response.hotel ?? {}) as HotelRaw),
    feature_flags: toPlanFeatureFlags(response.feature_flags),
  };
};

const hotelService = {
  getHotels,
  createHotel,
  updateHotelPlanTier,
};

export default hotelService;
