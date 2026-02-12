import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

const baseURL = "/api/v1";

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

// Manejador de errores global opcional
type ErrorHandler = (message: string, status?: number) => void;
let globalErrorHandler: ErrorHandler | null = null;

export const setGlobalErrorHandler = (handler: ErrorHandler) => {
  globalErrorHandler = handler;
};

// Interceptor para manejar los Errores de Dominio de forma global
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(() => {
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
    const errorData = error.response?.data as { error?: string; message?: string; error_code?: string } | undefined;
    const message = errorData?.message || errorData?.error || "Error inesperado en el servidor";

    if (globalErrorHandler && error.response?.status !== 401) {
      globalErrorHandler(message, error.response?.status);
    }

    // Registro de logs para monitoreo
    console.error(`🚨 HMS Error [${error.response?.status}]:`, message);

    return Promise.reject({
      status: error.response?.status,
      message: message,
      code: errorData?.error_code
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

const attachCsrf = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
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
