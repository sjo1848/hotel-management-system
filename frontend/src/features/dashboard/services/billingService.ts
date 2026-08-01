import client from "@/api/client";
import { emitDomainEvent } from "@/lib/domainEvents";

export type CashBalance = {
  total_amount_cents: number;
  cash_amount_cents: number;
  card_amount_cents: number;
  payment_count: number;
  opening_time: string;
  pending_amount_cents: number;
  pending_bookings_count: number;
};

export type CloseCashRequest = {
  notes: string;
  expected_cash_amount_cents: number;
  counted_cash_amount_cents: number;
  handoff_to: string;
};

export const getCashBalance = async () => {
  const response = await client.get("/billing/balance");
  return response.data as CashBalance;
};

export const closeCash = async (request: CloseCashRequest) => {
  const response = await client.post("/billing/close-cash", request);
  emitDomainEvent("billing.changed", { action: "cash_closed" });
  return response.data;
};

const billingService = {
  getCashBalance,
  closeCash,
};

export default billingService;
