import React, { useState, useEffect } from "react";
import { Plus, CheckCircle, Clock, XCircle, MoreVertical, Calendar as CalendarIcon, Filter, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getBookings, updateBooking, Booking, BookingStatus } from "@/features/bookings/services/bookingService";
import { getAllRooms, Room } from "@/features/rooms/services/roomService";
import BookingDetailsSheet from "@/features/bookings/components/BookingDetailsSheet";
import { useToast } from "@/components/ui/toast";

const BookingsPage = () => {
  const { toast } = useToast();
  const [data, setData] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bookingsData, roomsData] = await Promise.all([
        getBookings(),
        getAllRooms()
      ]);

      setData(bookingsData);

      const roomMap: Record<string, Room> = {};
      roomsData.forEach(room => {
        roomMap[room.id] = room;
      });
      setRooms(roomMap);

    } catch (error) {
      console.error("Failed to load bookings or rooms", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusUpdate = async (id: string, status: BookingStatus) => {
    try {
      await updateBooking(id, { status });

      toast({
        title: "Estado Actualizado",
        description: `La reserva ha sido marcada como ${status}`,
        variant: "success"
      });

      // Refresh local data
      await fetchData();
      // Update selected booking if it was open
      if (selectedBooking?.id === id) {
        const updated = (await getBookings()).find(b => b.id === id);
        if (updated) setSelectedBooking(updated);
      }
    } catch (error) {
      console.error("Failed to update booking status", error);
      toast({
        title: "Error",
        description: typeof error === "string" ? error : "No se pudo actualizar la reserva",
        variant: "error"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge variant="info" className="gap-1"><Clock className="w-3 h-3" /> Confirmada</Badge>;
      case "CheckedIn":
        return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Check-in</Badge>;
      case "CheckedOut":
        return <Badge variant="neutral" className="gap-1"><CheckCircle className="w-3 h-3" /> Finalizada</Badge>;
      case "Cancelled":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const columns: Column<Booking>[] = [
    {
      header: "Huésped",
      cell: (item) => (
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            setSelectedBooking(item);
            setIsSheetOpen(true);
          }}
        >
          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200 uppercase group-hover:bg-secondary/10 group-hover:text-secondary group-hover:border-secondary/20 transition-colors">
            {item.guest_name.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-slate-900 group-hover:text-secondary transition-colors">{item.guest_name}</div>
            <div className="text-xs text-slate-500">ID: {item.id.substring(0, 4)}...</div>
          </div>
        </div>
      ),
    },
    {
      header: "Habitación",
      cell: (item) => {
        const room = rooms[item.room_id];
        return (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {room ? room.room_number : "..."}
            </Badge>
          </div>
        );
      },
    },
    {
      header: "Fechas",
      cell: (item) => (
        <div className="flex flex-col text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="w-16 text-xs text-slate-400 uppercase">Llegada</span>
            {format(new Date(item.check_in), "dd MMM yyyy", { locale: es })}
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="w-16 text-xs text-slate-400 uppercase">Salida</span>
            {format(new Date(item.check_out), "dd MMM yyyy", { locale: es })}
          </div>
        </div>
      ),
    },
    {
      header: "Estado",
      cell: (item) => getStatusBadge(item.status),
    },
    {
      header: "Total",
      cell: (item) => (
        <span className="font-mono font-medium text-slate-900">
          ${(item.total_price_cents / 100).toLocaleString()}
        </span>
      ),
      className: "text-right",
    },
    {
      header: "",
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => {
              setSelectedBooking(item);
              setIsSheetOpen(true);
            }}>
              Ver Detalle
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {item.status === 'Confirmed' && (
              <DropdownMenuItem
                className="text-emerald-600"
                onClick={() => handleStatusUpdate(item.id, "CheckedIn")}
              >
                Registrar Check-in
              </DropdownMenuItem>
            )}
            {item.status === 'CheckedIn' && (
              <DropdownMenuItem
                className="text-blue-600"
                onClick={() => handleStatusUpdate(item.id, "CheckedOut")}
              >
                Registrar Check-out
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => handleStatusUpdate(item.id, "Cancelled")}
            >
              Cancelar Reserva
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "text-right w-[50px]",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
            Reservas
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona todas las reservas, check-ins y check-outs desde aquí.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 text-slate-600">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button className="h-9 gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
            <Plus className="w-4 h-4" /> Nueva Reserva
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={loading}
        searchable
        searchPlaceholder="Buscar por huésped o habitación..."
      />

      <BookingDetailsSheet
        booking={selectedBooking}
        room={selectedBooking ? rooms[selectedBooking.room_id] : null}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onUpdateStatus={handleStatusUpdate}
      />
    </div>
  );
};

export default BookingsPage;
