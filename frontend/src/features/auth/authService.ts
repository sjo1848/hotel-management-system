import client from "@/api/client";
import type { components } from "@/api/generated/openapi";
import { User, UserRole } from "@/types/domain";

type LoginRequest = components["schemas"]["LoginRequest"];
type LoginResponseRaw = components["schemas"]["LoginResponse"];
type UserViewRaw = components["schemas"]["UserView"];

export type LoginResponse = {
  access_token: string;
  expires_in: number;
  hotel_id: string;
  role: UserRole;
};

export type MeResponse = User;

const normalizeRole = (role: string | undefined): UserRole => {
  const normalized = role?.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "saas_admin") return "saas_admin";
  if (normalized === "receptionist") return "receptionist";
  if (normalized === "housekeeping") return "housekeeping";
  return "ops";
};

const toLoginResponse = (
  raw: LoginResponseRaw & { hotel_id?: string; role?: string },
): LoginResponse => ({
  access_token: raw.access_token ?? "",
  expires_in: raw.expires_in ?? 0,
  hotel_id: raw.hotel_id ?? "",
  role: normalizeRole(raw.role),
});

const toMeResponse = (raw: UserViewRaw & { hotel_id?: string; role?: string }): MeResponse => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  username: raw.username ?? "",
  role: normalizeRole(raw.role),
});

export const login = async (username: string, password: string, hotelId: string) => {
  const payload: LoginRequest = { hotel_id: hotelId, username, password };
  const response = await client.post("/auth/login", payload);
  return toLoginResponse(response.data as LoginResponseRaw & { hotel_id?: string; role?: string });
};

export const me = async () => {
  const response = await client.get("/auth/me");
  return toMeResponse(response.data as UserViewRaw & { hotel_id?: string; role?: string });
};

export const refresh = async () => {
  const response = await client.post("/auth/refresh");
  return toLoginResponse(response.data as LoginResponseRaw & { hotel_id?: string; role?: string });
};

export const logout = async () => {
  const response = await client.post("/auth/logout");
  return response.data;
};
