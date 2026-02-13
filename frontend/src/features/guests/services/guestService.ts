import { apiGet, apiPost } from "@/api/sdk";
import { Guest } from "@/types/domain";

export const getGuests = async () => {
  return apiGet<Guest[]>("/guests");
};

export type CreateGuestPayload = {
  full_name: string;
  email: string;
  phone?: string;
  created_at?: string;
};

export const createGuest = async (data: CreateGuestPayload) => {
  return apiPost<CreateGuestPayload, Guest>("/guests", data);
};

const guestService = {
  getGuests,
  createGuest,
};

export default guestService;
