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

export const createGuest = async (data: Omit<Guest, "id">) => {
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
