import client from "@/api/client";
import { Guest } from "@/types/domain";

export const getGuests = async () => {
  try {
    const response = await client.get("/guests");
    return response.data as Guest[];
  } catch (error) {
    console.error("Error fetching guests:", error);
    throw error;
  }
};

export type CreateGuestPayload = {
  full_name: string;
  email: string;
  phone?: string;
  created_at?: string;
};

export const createGuest = async (data: CreateGuestPayload) => {
  try {
    const response = await client.post("/guests", data);
    return response.data as Guest;
  } catch (error) {
    console.error("Error creating guest:", error);
    throw error;
  }
};

const guestService = {
  getGuests,
  createGuest,
};

export default guestService;
