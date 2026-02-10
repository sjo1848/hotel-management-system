import client from "@/api/client";

// Función individual
const getAllRooms = async (startDate, endDate) => {
  try {
    // Construimos la query string si hay fechas
    let query = "";
    if (startDate && endDate) {
      query = `?start_date=${startDate}&end_date=${endDate}`;
    }

    const response = await client.get(`/rooms${query}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching rooms:", error);
    throw error;
  }
};

const getRoomById = async (id) => {
  const response = await client.get(`/rooms/${id}`);
  return response.data;
};

// --- LA SOLUCIÓN ESTÁ AQUÍ ABAJO ---
// Agrupamos todo en un objeto y lo exportamos por defecto
const roomService = {
  getAllRooms,
  getRoomById,
};

export default roomService;
