import client from "@/api/client";

export const login = async (username, password) => {
  const response = await client.post("/auth/login", { username, password });
  return response.data;
};

export const me = async () => {
  const response = await client.get("/auth/me");
  return response.data;
};

export const refresh = async () => {
  const response = await client.post("/auth/refresh");
  return response.data;
};

export const logout = async () => {
  const response = await client.post("/auth/logout");
  return response.data;
};
