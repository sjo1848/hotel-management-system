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
        <Loader2 className="w-10 h-10 animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );

  if (error)
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 text-center p-10">
        {error}
      </div>
    );

  return (
    <>
      {!searchDates?.from || !searchDates?.to ? (
        <div className="border border-dashed border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/35 rounded-xl p-5 text-sm text-amber-700 dark:text-amber-200">
          Seleccioná un rango de fechas para habilitar reservas y ver disponibilidad real.
        </div>
      ) : null}

      {rooms.length === 0 ? (
        <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center bg-white dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            No hay habitaciones disponibles para ese rango.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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
