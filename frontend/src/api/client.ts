import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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
    if (error.response?.status === 401 && !originalRequest._retry) {
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
        if (data?.access_token) {
          localStorage.setItem("hms_token", data.access_token);
        }
        resolveQueue(null, data.access_token);
        return api(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        window.location.href = "/login";
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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hms_token");
  if (token && !config.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
