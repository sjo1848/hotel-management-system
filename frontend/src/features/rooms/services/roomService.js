import api from "../../../api/client";

export const roomService = {
  // Obtener todas las habitaciones
  getAll: async () => {
    const { data } = await api.get("/rooms");
    return data;
  },

  // Buscar disponibles (lo que hicimos en el Sprint 3)
  getAvailable: async (start, end) => {
    const { data } = await api.get(
      `/rooms/available?start=${start}&end=${end}`,
    );
    return data;
  },
};
