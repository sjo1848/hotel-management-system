import { apiDelete, apiGet, apiPost } from "@/api/sdk";
import { User, UserRole } from "@/types/domain";

export type CreateUserPayload = {
  username: string;
  password: string;
  role: UserRole;
};

export const getUsers = async () => {
  return apiGet<User[]>("/users");
};

export const createUser = async (payload: CreateUserPayload) => {
  return apiPost<CreateUserPayload, User>("/users", payload);
};

export const deleteUser = async (id: string) => {
  return apiDelete<{ status: string }>(`/users/${id}`);
};
