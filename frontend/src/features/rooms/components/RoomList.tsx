import { useEffect, useMemo, useState } from "react";
import RoomCard from "./RoomCard";
import roomService from "../services/roomService";
import BookingDrawer from "../../bookings/components/BookingDrawer";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Room } from "@/types/domain";

type SearchDates = {
  from: string;
  to: string;
} | null;

const RoomList = ({ searchDates }: { searchDates: SearchDates }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Estado para manejar el Drawer
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const nights = useMemo(() => {
    if (!searchDates?.from || !searchDates?.to) return 0;
    return Math.max(
      0,
      differenceInCalendarDays(parseISO(searchDates.to), parseISO(searchDates.from)),
    );
  }, [searchDates]);

  const loadRooms = (start?: string | null, end?: string | null) => {
    setLoading(true);
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
  };

  useEffect(() => {
    // Usamos las fechas del buscador o null si no hay
    const start = searchDates?.from || null;
    const end = searchDates?.to || null;
    loadRooms(start, end);
  }, [searchDates]); // Eliminado toast de deps para evitar bucles si cambiara

  // Handler para abrir el drawer
  const handleBookClick = (room: Room) => {
    if (!searchDates?.from || !searchDates?.to) {
      toast({
        title: "Seleccioná fechas",
        description: "Elegí un rango de estancia para reservar.",
        variant: "error",
      });
      return;
    }
    setSelectedRoom(room);
    setIsDrawerOpen(true);
  };

  // Handler para cuando la reserva fue exitosa
  const handleBookingSuccess = () => {
    toast({
      title: "Reserva creada",
      description: "La habitación quedó reservada.",
      variant: "success",
    });
    const start = searchDates?.from || null;
    const end = searchDates?.to || null;
    loadRooms(start, end);
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    );

  if (error)
    return <div className="text-red-500 text-center p-10">{error}</div>;

  return (
    <>
      {!searchDates?.from || !searchDates?.to ? (
        <div className="border border-dashed border-amber-200 bg-amber-50/60 rounded-xl p-5 text-sm text-amber-700">
          Seleccioná un rango de fechas para habilitar reservas y ver disponibilidad real.
        </div>
      ) : null}

      {rooms.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center bg-card">
          <p className="text-muted-foreground font-medium">
            No hay habitaciones disponibles para ese rango.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
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
            disabled={!searchDates?.from || !searchDates?.to}
            nights={nights}
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
