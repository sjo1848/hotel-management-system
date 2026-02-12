import client from "@/api/client";
import { User, UserRole } from "@/types/domain";

export type CreateUserPayload = {
  username: string;
  password: string;
  role: UserRole;
};

export const getUsers = async () => {
  const response = await client.get("/users");
  return response.data as User[];
};

export const createUser = async (payload: CreateUserPayload) => {
  const response = await client.post("/users", payload);
  return response.data as User;
};
