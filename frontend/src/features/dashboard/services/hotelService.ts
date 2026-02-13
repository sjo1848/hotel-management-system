import client from "@/api/client";
import { Hotel } from "@/types/domain";

export const getHotels = async () => {
  const response = await client.get("/hotels");
  return response.data as Hotel[];
};

export const createHotel = async (hotelData: { name: string, address?: string }) => {
  const response = await client.post("/hotels", hotelData);
  return response.data as Hotel;
};

const hotelService = {
  getHotels,
  createHotel,
};

export default hotelService;
