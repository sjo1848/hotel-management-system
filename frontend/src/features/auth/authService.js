import client from "@/api/client";

export const login = async (username, password) => {
  const response = await client.post("/auth/login", { username, password });
  return response.data;
};
