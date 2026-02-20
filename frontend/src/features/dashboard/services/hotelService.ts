import { apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { Hotel } from "@/types/domain";

type HotelRaw = components["schemas"]["Hotel"];
type CreateHotelRequest = components["schemas"]["CreateHotelRequest"];

const toHotel = (raw: HotelRaw): Hotel => ({
  id: raw.id ?? "",
  name: raw.name ?? "",
  address: raw.address ?? undefined,
});

export const getHotels = async () => {
  const response = await apiGet<HotelRaw[]>("/hotels");
  return (response ?? []).map(toHotel);
};

export const createHotel = async (hotelData: CreateHotelRequest) => {
  const response = await apiPost<CreateHotelRequest, HotelRaw>("/hotels", hotelData);
  return toHotel(response);
};

const hotelService = {
  getHotels,
  createHotel,
};

export default hotelService;
