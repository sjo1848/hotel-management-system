import { apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { Guest } from "@/types/domain";

type GuestRaw = components["schemas"]["Guest"] & {
  hotel_id?: string;
  created_at?: string;
};

export type CreateGuestPayload = components["schemas"]["CreateGuestRequest"] & {
  created_at?: string;
};

const toGuest = (raw: GuestRaw): Guest => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  full_name: raw.full_name ?? "",
  email: raw.email ?? "",
  phone: raw.phone ?? undefined,
  created_at: raw.created_at ?? undefined,
});

export const getGuests = async () => {
  const response = await apiGet<GuestRaw[]>("/guests");
  return (response ?? []).map(toGuest);
};

export const createGuest = async (data: CreateGuestPayload) => {
  const payload: components["schemas"]["CreateGuestRequest"] = {
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
  };
  const response = await apiPost<components["schemas"]["CreateGuestRequest"], GuestRaw>(
    "/guests",
    payload,
  );
  return toGuest(response);
};

const guestService = {
  getGuests,
  createGuest,
};

export default guestService;
