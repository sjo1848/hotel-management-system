import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  me as apiMe,
  LoginResponse,
  MeResponse,
} from "./authService";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthContextValue = {
  status: AuthStatus;
  user: MeResponse | null;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<MeResponse>;
};

export const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  user: null,
  login: async () => {
    throw new Error("AuthContext not ready");
  },
  logout: async () => {},
  refreshUser: async () => {
    throw new Error("AuthContext not ready");
  },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const inFlightRef = useRef<Promise<MeResponse> | null>(null);

  const refreshUser = useCallback(async () => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    const request = apiMe()
      .then((data) => {
        setUser(data);
        setStatus("authenticated");
        return data;
      })
      .catch((error) => {
        setUser(null);
        setStatus("unauthenticated");
        throw error;
      })
      .finally(() => {
        inFlightRef.current = null;
      });
    inFlightRef.current = request;
    return request;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
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
    if (status !== "loading") return;
    if (window.location.pathname === "/login") {
      setStatus("unauthenticated");
      return;
    }
    refreshUser().catch(() => null);
  }, [refreshUser, status]);

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
