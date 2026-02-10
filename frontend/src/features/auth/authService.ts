import client from "@/api/client";

export type LoginResponse = {
  access_token: string;
  expires_in: number;
  role: string;
};

export type MeResponse = {
  id: string;
  username: string;
  role: string;
};

export const login = async (username: string, password: string) => {
  const response = await client.post("/auth/login", { username, password });
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
