import client from "@/api/client";

export type CashBalance = {
  total_amount_cents: number;
  cash_amount_cents: number;
  card_amount_cents: number;
};

export const getCashBalance = async () => {
  const response = await client.get("/billing/balance");
  return response.data as CashBalance;
};

export const closeCash = async (notes?: string) => {
  const response = await client.post("/billing/close-cash", { notes });
  return response.data;
};

const billingService = {
  getCashBalance,
  closeCash,
};

export default billingService;
