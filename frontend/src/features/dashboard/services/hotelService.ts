import client from "@/api/client";
import { emitDomainEvent } from "@/lib/domainEvents";
import { Hotel } from "@/types/domain";

export const getHotels = async () => {
  const response = await client.get("/hotels");
  return response.data as Hotel[];
};

export const createHotel = async (hotelData: { name: string, address?: string }) => {
  const response = await client.post("/hotels", hotelData);
  const hotel = response.data as Hotel;
  emitDomainEvent("hotels.changed", { action: "created", hotel_id: hotel.id });
  return hotel;
};

const hotelService = {
  getHotels,
  createHotel,
};

export default hotelService;
