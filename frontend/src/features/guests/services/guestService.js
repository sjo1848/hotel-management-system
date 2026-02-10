import client from "@/api/client";

export const getGuests = async () => {
  const response = await client.get("/guests");
  return response.data;
};

export const createGuest = async (guestData) => {
  try {
    const response = await client.post("/guests", guestData);
    return response.data;
  } catch (error) {
    console.error("Error creando huésped:", error);
    throw error.response?.data?.error || "Error al crear huésped";
  }
};
