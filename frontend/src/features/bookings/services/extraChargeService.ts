import { apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { ExtraCharge } from "@/types/domain";

type ExtraChargeRaw = components["schemas"]["ExtraCharge"];
type AddExtraChargeRequest = components["schemas"]["AddExtraChargeRequest"];

const toExtraCharge = (raw: ExtraChargeRaw): ExtraCharge => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  booking_id: raw.booking_id ?? "",
  description: raw.description ?? "",
  amount_cents: raw.amount_cents ?? 0,
  category: raw.category ?? "",
  created_at: raw.created_at,
});

export const getExtraCharges = async (bookingId: string) => {
  const response = await apiGet<ExtraChargeRaw[]>(`/bookings/${bookingId}/extra-charges`);
  return (response ?? []).map(toExtraCharge);
};

export const addExtraCharge = async (bookingId: string, data: AddExtraChargeRequest) => {
  const response = await apiPost<AddExtraChargeRequest, ExtraChargeRaw>(
    `/bookings/${bookingId}/extra-charges`,
    data,
  );
  return toExtraCharge(response);
};

const extraChargeService = {
  getExtraCharges,
  addExtraCharge,
};

export default extraChargeService;
