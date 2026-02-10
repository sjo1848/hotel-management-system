import client from "@/api/client";

export const login = async (username, password) => {
  const response = await client.post("/auth/login", { username, password });
  return response.data;
};

export const refresh = async (refreshToken) => {
  const response = await client.post("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return response.data;
};

export const logout = async (refreshToken) => {
  const response = await client.post("/auth/logout", {
    refresh_token: refreshToken,
  });
  return response.data;
};
