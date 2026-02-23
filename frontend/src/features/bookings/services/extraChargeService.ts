import client from "@/api/client";
import { emitDomainEvent } from "@/lib/domainEvents";
import { ExtraCharge } from "@/types/domain";

export const getExtraCharges = async (bookingId: string) => {
  const response = await client.get(`/bookings/${bookingId}/extra-charges`);
  return response.data as ExtraCharge[];
};

export const addExtraCharge = async (bookingId: string, data: { description: string, amount_cents: number, category: string }) => {
  const response = await client.post(`/bookings/${bookingId}/extra-charges`, data);
  const charge = response.data as ExtraCharge;
  emitDomainEvent("billing.changed", { action: "extra_charge_created", booking_id: bookingId });
  return charge;
};

const extraChargeService = {
  getExtraCharges,
  addExtraCharge,
};

export default extraChargeService;
