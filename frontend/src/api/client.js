import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api", // Nuestra base de Rust
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para manejar los Errores de Dominio (Sprint 5) de forma global
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
