import client from "@/api/client";

export type Guest = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
};

export type CreateGuestPayload = {
  full_name: string;
  email: string;
  phone?: string | null;
};

export const getGuests = async () => {
  const response = await client.get("/guests");
  return response.data as Guest[];
};

export const createGuest = async (guestData: CreateGuestPayload) => {
  try {
    const response = await client.post("/guests", guestData);
    return response.data as Guest;
  } catch (error) {
    console.error("Error creando huésped:", error);
    const message =
      (error as { response?: { data?: { error?: string } } })?.response?.data
        ?.error || "Error al crear huésped";
    throw message;
  }
};
