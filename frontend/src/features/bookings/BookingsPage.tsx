import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, CheckCircle, Clock, XCircle, MoreVertical, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBookings, updateBooking } from "./services/bookingService";
import { Booking } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import { downloadCSV, cn } from "@/lib/utils";
import BookingEditDrawer from "./components/BookingEditDrawer";
import BookingDetailsSheet from "./components/BookingDetailsSheet";

const BookingsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedBooking, setSelectedRoom] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (error) {
      console.error("Failed to fetch bookings", error);
      toast({ title: "Error", description: "No se pudieron cargar las reservas", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      await updateBooking(id, { status: "Cancelled" });
      toast({ title: "Reserva cancelada", variant: "success" });
      fetchBookings();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cancelar la reserva", variant: "error" });
    }
  };

  const handleExport = () => {
    if (bookings.length === 0) {
      toast({ title: "Sin datos", description: "No hay reservas para exportar", variant: "info" });
      return;
    }
    downloadCSV(bookings, `reservas_${new Date().toISOString().split('T')[0]}.csv`);
    toast({ title: "Exportación exitosa", description: "El archivo CSV ha sido generado", variant: "success" });
  };

  const filteredBookings = bookings.filter(b => 
    filterStatus === "all" ? true : b.status === filterStatus
  );

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
        <div>
          <div className="font-bold text-slate-900">{item.guest_name}</div>
          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">ID: {item.id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      header: "Habitación",
      accessorKey: "room_id",
      cell: (item) => <Badge variant="outline" className="font-mono">Room {item.room_id.slice(0, 4)}</Badge>
    },
    {
      header: "Check-in",
      accessorKey: "check_in",
    },
    {
      header: "Check-out",
      accessorKey: "check_out",
    },
    {
      header: "Total",
      cell: (item) => <span className="font-mono font-bold text-slate-700">${(item.total_price_cents / 100).toLocaleString()}</span>,
    },
    {
      header: "Estado",
      cell: (item) => getStatusBadge(item.status),
    },
    {
      header: "",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-indigo-600 font-bold text-xs"
            onClick={() => {
              setSelectedRoom(item);
              setIsDetailsOpen(true);
            }}
          >
            Detalles
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setSelectedRoom(item);
                setIsEditOpen(true);
              }}>
                Editar Estado
              </DropdownMenuItem>
              {item.status !== "Cancelled" && item.status !== "CheckedOut" && (
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => handleCancel(item.id)}
                >
                  Cancelar Reserva
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      className: "w-[120px]",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
            Reservas
          </h2>
          <p className="text-slate-500 font-medium mt-2">
            Gestión de estancias y disponibilidad.
          </p>
        </div>

        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-10 rounded-xl border-slate-200", filterStatus !== "all" && "bg-indigo-50 border-indigo-200 text-indigo-700")}>
                <Filter className="w-4 h-4 mr-2" /> 
                {filterStatus === "all" ? "Filtros" : `Estado: ${filterStatus}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white">
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>Todos los estados</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("Confirmed")}>Confirmadas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("CheckedIn")}>En el Hotel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("CheckedOut")}>Finalizadas</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("Cancelled")}>Canceladas</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 rounded-xl border-slate-200"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
          <Button 
            size="sm" 
            className="h-10 rounded-xl bg-slate-900 shadow-lg shadow-slate-200"
            onClick={() => navigate("/rooms")}
          >
            <Plus className="w-4 h-4 mr-2" /> Nueva Reserva
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredBookings}
          isLoading={loading}
          searchable
          searchPlaceholder="Buscar por huésped o ID..."
        />
      </div>

      {selectedBooking && (
        <>
          <BookingEditDrawer 
            booking={selectedBooking}
            isOpen={isEditOpen}
            onClose={() => {
              setIsEditOpen(false);
              setSelectedRoom(null);
            }}
            onSuccess={fetchBookings}
            onViewDetails={() => setIsDetailsOpen(true)}
          />
          <BookingDetailsSheet
            booking={selectedBooking}
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false);
              setSelectedRoom(null);
            }}
          />
        </>
      )}
    </div>
  );
};

export default BookingsPage;
