import client from "@/api/client";
import { User } from "@/types/domain";

export type LoginResponse = {
  access_token: string;
  expires_in: number;
  hotel_id: string;
  role: string;
};

export type MeResponse = User;

const DEFAULT_HOTEL_ID = "00000000-0000-0000-0000-000000000001";

export const login = async (
  username: string,
  password: string,
  hotelId: string = DEFAULT_HOTEL_ID,
) => {
  const response = await client.post("/auth/login", { hotel_id: hotelId, username, password });
  return response.data as LoginResponse;
};

export const me = async () => {
  const response = await client.get("/auth/me");
  return response.data as MeResponse;
};

export const refresh = async () => {
  const response = await client.post("/auth/refresh");
  return response.data as LoginResponse;
};

export const logout = async () => {
  const response = await client.post("/auth/logout");
  return response.data;
};
