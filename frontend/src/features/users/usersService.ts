import client from "@/api/client";

export type User = {
  id: string;
  username: string;
  role: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  role: string;
};

export const getUsers = async () => {
  const response = await client.get("/users");
  return response.data as User[];
};

export const createUser = async (payload: CreateUserPayload) => {
  const response = await client.post("/users", payload);
  return response.data as User;
};
