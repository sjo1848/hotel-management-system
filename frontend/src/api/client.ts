import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

const api = axios.create({
  baseURL, // Nuestra base de Rust
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const authApi = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let isRefreshing = false;
type PendingRequest = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};
let pendingQueue: PendingRequest[] = [];

const resolveQueue = (error: unknown, token: string | null = null) => {
  pendingQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  pendingQueue = [];
};

// Interceptor para manejar los Errores de Dominio (Sprint 5) de forma global
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/me");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await authApi.post("/auth/refresh");
        resolveQueue(null, data.access_token);
        return api(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Si el backend mandó un error tipado (400, 409, 404)
    const message =
      (error.response?.data as { error?: string } | undefined)?.error ||
      "Error inesperado en el servidor";

    // Aquí podrías disparar un Toast o notificación global más adelante
    console.error(`🚨 HMS Error [${error.response?.status}]:`, message);

    return Promise.reject({
      status: error.response?.status,
      message: message,
    });
  },
);

const getCookie = (name: string) => {
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return match.substring(name.length + 1);
};

const attachCsrf = (config: AxiosRequestConfig) => {
  const method = (config.method || "get").toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["x-csrf-token"] = csrfToken;
    }
  }
  return config;
};

api.interceptors.request.use(attachCsrf);
authApi.interceptors.request.use(attachCsrf);

export default api;
