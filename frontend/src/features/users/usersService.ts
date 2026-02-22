import { apiDelete, apiGet, apiPost } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import { User, UserRole } from "@/types/domain";

type UserRaw = components["schemas"]["UserView"] & {
  hotel_id?: string;
  role?: string;
};

export type CreateUserPayload = components["schemas"]["CreateUserRequest"];

const normalizeRole = (role: string | undefined): UserRole => {
  const normalized = role?.trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "saas_admin") return "saas_admin";
  if (normalized === "receptionist") return "receptionist";
  if (normalized === "housekeeping") return "housekeeping";
  return "ops";
};

const toUser = (raw: UserRaw): User => ({
  id: raw.id ?? "",
  hotel_id: raw.hotel_id ?? "",
  username: raw.username ?? "",
  role: normalizeRole(raw.role),
});

export const getUsers = async () => {
  const response = await apiGet<UserRaw[]>("/users");
  return (response ?? []).map(toUser);
};

export const createUser = async (payload: CreateUserPayload) => {
  const response = await apiPost<CreateUserPayload, UserRaw>("/users", payload);
  return toUser(response);
};

export const deleteUser = async (id: string) => {
  return apiDelete<{ status: string }>(`/users/${id}`);
};
