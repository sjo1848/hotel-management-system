import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertCircle, Wrench, CheckCircle2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import roomService, { type Room } from "@/features/rooms/services/roomService";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

const HousekeepingPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const { toast } = useToast();

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await roomService.getAllRooms();
      setRooms(data);
    } catch (error) {
      toast({
        title: "Error al cargar habitaciones",
        description: "No se pudo obtener el estado actual.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleUpdateStatus = async (roomId: string, newStatus: string) => {
    try {
      await roomService.updateRoomStatus(roomId, newStatus);
      toast({
        title: "Estado actualizado",
        description: `Habitación marcada como ${newStatus.toLowerCase()}.`,
        variant: "success",
      });
      loadRooms();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado.",
        variant: "error",
      });
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === filter;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DIRTY":
        return {
          color: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
          label: "Sucia",
          action: "Limpiar",
          nextStatus: "AVAILABLE",
          btnColor: "bg-emerald-600 hover:bg-emerald-700",
        };
      case "MAINTENANCE":
        return {
          color: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Wrench,
          label: "En Mantenimiento",
          action: "Habilitar",
          nextStatus: "AVAILABLE",
          btnColor: "bg-slate-900",
        };
      case "OCCUPIED":
        return {
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: CheckCircle2,
          label: "Ocupada",
          action: "Bloquear",
          nextStatus: "MAINTENANCE",
          btnColor: "bg-amber-600 hover:bg-amber-700",
        };
      default:
        return {
          color: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: Sparkles,
          label: "Limpia",
          action: "Bloquear",
          nextStatus: "MAINTENANCE",
          btnColor: "bg-amber-600 hover:bg-amber-700",
        };
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Housekeeping</h2>
          <p className="text-slate-500 font-medium mt-3">
            Gestión de limpieza y estado físico de las habitaciones.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Button 
            variant={filter === "ALL" ? "secondary" : "ghost"} 
            size="sm" 
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest"
            onClick={() => setFilter("ALL")}
          >
            Todas
          </Button>
          <Button 
            variant={filter === "DIRTY" ? "secondary" : "ghost"} 
            size="sm" 
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest text-rose-600"
            onClick={() => setFilter("DIRTY")}
          >
            Sucias
          </Button>
          <Button 
            variant={filter === "MAINTENANCE" ? "secondary" : "ghost"} 
            size="sm" 
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest text-amber-600"
            onClick={() => setFilter("MAINTENANCE")}
          >
            Mantenimiento
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRooms.map((room) => {
            const config = getStatusConfig(room.status);
            const StatusIcon = config.icon;
            
            return (
              <Card 
                key={room.id} 
                className="border-none rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all group"
              >
                <div className={`h-2 w-full ${config.color.split(' ')[0]}`} />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-2xl font-black text-slate-900 tracking-tighter">
                        {room.room_number}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {room.room_type}
                      </div>
                    </div>
                    <Badge variant="outline" className={`${config.color} border-none font-black text-[10px] uppercase tracking-widest py-1 px-3 rounded-lg`}>
                      <StatusIcon className="w-3 h-3 mr-1.5" />
                      {config.label}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      className={`w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-lg transition-all active:scale-95 ${config.btnColor}`}
                      onClick={() => handleUpdateStatus(room.id, config.nextStatus)}
                    >
                      {config.action}
                    </Button>
                    
                    {room.status === 'AVAILABLE' && (
                      <Button 
                        variant="outline"
                        className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
                        onClick={() => handleUpdateStatus(room.id, 'DIRTY')}
                      >
                        Marcar Sucia
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HousekeepingPage;
