import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api", // Nuestra base de Rust
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const authApi = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const resolveQueue = (error, token = null) => {
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (!localStorage.getItem("hms_token")) {
        localStorage.removeItem("hms_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await authApi.post("/auth/refresh");
        localStorage.setItem("hms_token", data.access_token);
        resolveQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        localStorage.removeItem("hms_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Si el backend mandó un error tipado (400, 409, 404)
    const message =
      error.response?.data?.error || "Error inesperado en el servidor";

    // Aquí podrías disparar un Toast o notificación global más adelante
    console.error(`🚨 HMS Error [${error.response?.status}]:`, message);

    return Promise.reject({
      status: error.response?.status,
      message: message,
    });
  },
);

export default api;
