import { apiGet, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
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
  const guest = await apiPost<CreateGuestPayload, Guest>("/guests", data);
  emitDomainEvent("guests.changed", { action: "created", guest_id: guest.id });
  return guest;
};

const guestService = {
  getGuests,
  createGuest,
};

export default guestService;
