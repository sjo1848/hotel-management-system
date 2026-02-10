import client from "@/api/client";

export const getUsers = async () => {
  const response = await client.get("/users");
  return response.data;
};

export const createUser = async (payload) => {
  const response = await client.post("/users", payload);
  return response.data;
};
