import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "./authService";

export const AuthContext = createContext({
  status: "loading",
  user: null,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiMe();
      setUser(data);
      setStatus("authenticated");
      return data;
    } catch (error) {
      setUser(null);
      setStatus("unauthenticated");
      throw error;
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    if (data?.access_token) {
      localStorage.setItem("hms_token", data.access_token);
    }
    await refreshUser();
    return data;
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      localStorage.removeItem("hms_token");
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    refreshUser().catch(() => null);
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      logout,
      refreshUser,
    }),
    [status, user, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
