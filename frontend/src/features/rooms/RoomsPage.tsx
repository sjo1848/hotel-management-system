import React, { useState, useEffect } from "react";
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
import { getAllRooms, Room } from "@/features/rooms/services/roomService";

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await getAllRooms();
        setRooms(data);
      } catch (error) {
        console.error("Failed to fetch rooms", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const columns: Column<Room>[] = [
    {
      header: "Habitación",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm ${getStatusColor(item.status)}`}>
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
      cell: () => (
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
      ),
      className: "w-[50px]",
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

      {viewMode === "list" ? (
        <DataTable
          columns={columns}
          data={rooms}
          isLoading={loading}
          searchable
          searchPlaceholder="Buscar habitación..."
          actions={
            <Button size="sm" className="h-9 gap-2 shadow-lg shadow-primary/20">
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
              <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${getStatusColor(room.status)} blur-xl group-hover:scale-150 transition-transform duration-500`} />

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
                {getStatusBadge(room.status)}
              </div>
            </div>
          ))}

          {/* Add New Room Card */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-slate-400 hover:text-secondary hover:border-secondary/50 hover:bg-secondary/5 transition-all cursor-pointer group h-full min-h-[180px]">
            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center mb-3 transition-colors shadow-sm">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Añadir Habitación</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsPage;
