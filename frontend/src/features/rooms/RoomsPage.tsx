import { useState, useEffect } from "react";
import {
  Grid,
  List,
  MoreVertical,
  DoorClosed,
  User,
  SprayCan,
  Wrench,
  CheckCircle,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getAllRooms } from "@/features/rooms/services/roomService";
import { Room } from "@/types/domain";
import BookingDrawer from "@/features/bookings/components/BookingDrawer";
import AvailabilityPicker from "./components/AvailabilityPicker";
import { useToast } from "@/components/ui/toast";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Available": return "bg-emerald-500";
    case "Occupied": return "bg-red-500";
    case "Dirty": return "bg-amber-500";
    case "Maintenance": return "bg-slate-500";
    default: return "bg-slate-300";
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Available":
      return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Disponible</Badge>;
    case "Occupied":
      return <Badge variant="destructive" className="gap-1"><User className="w-3 h-3" /> Ocupada</Badge>;
    case "Dirty":
      return <Badge variant="warning" className="gap-1"><SprayCan className="w-3 h-3" /> Limpieza</Badge>;
    case "Maintenance":
      return <Badge variant="neutral" className="gap-1"><Wrench className="w-3 h-3" /> Mantenimiento</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const RoomsPage = () => {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Booking State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bookingDates, setBookingDates] = useState<{from: string, to: string} | null>(null);

  const fetchRooms = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const data = await getAllRooms(start, end);
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch rooms", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSearchAvailability = (from: string, to: string) => {
    setBookingDates({ from, to });
    setIsSearching(true);
    fetchRooms(from, to);
  };

  const handleClearSearch = () => {
    setBookingDates(null);
    setIsSearching(false);
    fetchRooms();
  };

  const handleBookingSuccess = () => {
    fetchRooms(bookingDates?.from, bookingDates?.to);
  };

  const columns: Column<Room>[] = [
    {
      header: "Habitación",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm",
            getStatusColor(item.status)
          )}>
            {item.room_number}
          </div>
          <div>
            <div className="font-medium text-slate-900">Habitación {item.room_number}</div>
            <div className="text-xs text-slate-500">{item.room_type}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Tipo",
      accessorKey: "room_type",
      className: "w-32",
    },
    {
      header: "Precio / Noche",
      cell: (item) => <span className="font-mono text-slate-700">${(item.price_cents / 100).toLocaleString()}</span>,
    },
    {
      header: "Estado",
      cell: (item) => getStatusBadge(item.status),
    },
    {
      header: "",
      cell: (item) => (
        <div className="flex items-center gap-2">
          {item.status === "Available" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              onClick={() => {
                setSelectedRoom(item);
                setIsDrawerOpen(true);
              }}
            >
              Reservar
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Ver Detalle</DropdownMenuItem>
              <DropdownMenuItem>Marcar Limpia</DropdownMenuItem>
              <DropdownMenuItem>Mantenimiento</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-[150px]",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <DoorClosed className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Habitaciones
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-11">
            Vista general del estado de ocupación y limpieza.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-3 rounded-md transition-all", viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
            onClick={() => setViewMode("grid")}
          >
            <Grid className="w-4 h-4 mr-2" />
            Grid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 px-3 rounded-md transition-all", viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
        </div>
      </div>

      <AvailabilityPicker
        onSearch={handleSearchAvailability}
        onClear={handleClearSearch}
      />

      {isSearching && (
        <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-6 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">
                Mostrando habitaciones disponibles
              </p>
              <p className="text-xs text-indigo-600">
                Para el periodo: <span className="font-bold">{bookingDates?.from} al {bookingDates?.to}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-indigo-600 leading-none">
              {rooms.length}
            </p>
            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">
              Encontradas
            </p>
          </div>
        </div>
      )}

      {rooms.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <DoorClosed className="w-10 h-10 opacity-20" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">No hay habitaciones disponibles</h3>
          <p className="text-sm max-w-[300px] text-center mt-1">
            Intentá con otro rango de fechas o revisá el estado de limpieza.
          </p>
          {isSearching && (
            <Button variant="link" onClick={handleClearSearch} className="mt-4 text-indigo-600">
              Ver todas las habitaciones
            </Button>
          )}
        </div>
      )}

      {!loading && rooms.length > 0 && (
        viewMode === "list" ? (
          <DataTable
            columns={columns}
            data={rooms}
            isLoading={loading}
            searchable
            searchPlaceholder="Buscar habitación..."
            actions={
              <Button
                size="sm"
                className="h-9 gap-2 shadow-lg shadow-primary/20"
                onClick={() => toast({ title: "Configuración", description: "El módulo de gestión de catálogo está en desarrollo." })}
              >
                <Plus className="w-4 h-4" /> Añadir Habitación
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
              >
                <div className={cn(
                  "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 blur-xl group-hover:scale-150 transition-transform duration-500",
                  getStatusColor(room.status)
                )} />

                <div className="flex justify-between items-start mb-4">
                  <div className={cn("text-lg font-black font-mono px-3 py-1 rounded-lg text-white shadow-md", getStatusColor(room.status))}>
                    {room.room_number}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 rounded-full">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Ver Detalle</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1 mb-4">
                  <h3 className="font-bold text-slate-800">{room.room_type}</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Status: {room.status}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Precio</span>
                    <span className="font-mono font-medium text-slate-700">${(room.price_cents / 100).toLocaleString()}</span>
                  </div>
                  {room.status === "Available" ? (
                    <Button
                      size="sm"
                      className="h-8 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                      onClick={() => {
                        setSelectedRoom(room);
                        setIsDrawerOpen(true);
                      }}
                    >
                      Reservar
                    </Button>
                  ) : (
                    getStatusBadge(room.status)
                  )}
                </div>
              </div>
            ))}

            {/* Add New Room Card */}
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-slate-400 hover:text-secondary hover:border-secondary/50 hover:bg-secondary/5 transition-all cursor-pointer group h-full min-h-[180px]"
              onClick={() => toast({ title: "Configuración", description: "El módulo de gestión de catálogo está en desarrollo." })}
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center mb-3 transition-colors shadow-sm">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium text-sm">Añadir Habitación</span>
            </div>
          </div>
        )
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-50 rounded-xl border border-slate-100 p-5 h-[180px] animate-pulse" />
          ))}
        </div>
      )}

      <BookingDrawer
        room={selectedRoom}
        dates={bookingDates}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
};

export default RoomsPage;
