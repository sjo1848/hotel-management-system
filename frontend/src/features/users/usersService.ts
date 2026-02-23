import { apiDelete, apiGet, apiPost } from "@/api/sdk";
import { emitDomainEvent } from "@/lib/domainEvents";
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
  const user = await apiPost<CreateUserPayload, User>("/users", payload);
  emitDomainEvent("users.changed", { action: "created", user_id: user.id });
  return user;
};

export const deleteUser = async (id: string) => {
  const response = await apiDelete<{ status: string }>(`/users/${id}`);
  emitDomainEvent("users.changed", { action: "deleted", user_id: id });
  return response;
};
