import React, { useEffect, useState } from "react";
import RoomCard from "./RoomCard";
import roomService from "../services/roomService";
// Importamos el Drawer que creaste recién
import BookingDrawer from "../../bookings/components/BookingDrawer";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const RoomList = ({ searchDates }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

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
      .catch(() => {
        setError("Error cargando habitaciones");
        toast({
          title: "Error al cargar habitaciones",
          description: "Reintentá en unos segundos.",
          variant: "error",
        });
      })
      .finally(() => setLoading(false));
  }, [searchDates, toast]); // Se recarga cuando cambian las fechas

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
      {rooms.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center bg-white">
          <p className="text-slate-600 font-medium">
            No hay habitaciones disponibles para ese rango.
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Probá con otras fechas.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            onBook={() => handleBookClick(room)} // Pasamos la función
          />
        ))}
      </div>
      )}

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
