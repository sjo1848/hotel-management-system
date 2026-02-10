import React, { useEffect, useState } from "react";
import RoomCard from "./RoomCard";
import roomService from "../services/roomService";
// Importamos el Drawer que creaste recién
import BookingDrawer from "../../bookings/components/BookingDrawer";
import { Loader2 } from "lucide-react";

const RoomList = ({ searchDates }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Estado para manejar el Drawer
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Usamos las fechas del buscador o null si no hay
    const start = searchDates?.from || null;
    const end = searchDates?.to || null;

    roomService
      .getAllRooms(start, end)
      .then(setRooms)
      .catch((err) => setError("Error cargando habitaciones"))
      .finally(() => setLoading(false));
  }, [searchDates]); // Se recarga cuando cambian las fechas

  // Handler para abrir el drawer
  const handleBookClick = (room) => {
    setSelectedRoom(room);
    setIsDrawerOpen(true);
  };

  // Handler para cuando la reserva fue exitosa
  const handleBookingSuccess = () => {
    alert("¡Reserva creada con éxito! 🚀");
    // Aquí podríamos recargar la lista de habitaciones para actualizar disponibilidad
    // loadRooms();
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
      </div>
    );

  if (error)
    return <div className="text-red-500 text-center p-10">{error}</div>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onBook={() => handleBookClick(room)} // Pasamos la función
          />
        ))}
      </div>

      {/* El Drawer vive aquí, "escondido" hasta que se abre */}
      <BookingDrawer
        room={selectedRoom}
        dates={searchDates}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleBookingSuccess}
      />
    </>
  );
};

export default RoomList;
