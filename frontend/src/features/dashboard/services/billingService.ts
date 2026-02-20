import { apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";

export type CashBalance = {
  total_amount_cents: number;
  cash_amount_cents: number;
  card_amount_cents: number;
};

type CashBalanceRaw = components["schemas"]["BillingBalance"];
type CashClosureRaw = components["schemas"]["CashClosure"];

const toCashBalance = (raw: CashBalanceRaw): CashBalance => ({
  total_amount_cents: raw.total_amount_cents ?? 0,
  cash_amount_cents: raw.cash_amount_cents ?? 0,
  card_amount_cents: raw.card_amount_cents ?? 0,
});

export const getCashBalance = async () => {
  const response = await apiGet<CashBalanceRaw>("/billing/balance");
  return toCashBalance(response);
};

export const closeCash = async (notes?: string) => {
  return apiPost<{ notes?: string }, CashClosureRaw>("/billing/close-cash", { notes });
};

const billingService = {
  getCashBalance,
  closeCash,
};

export default billingService;
