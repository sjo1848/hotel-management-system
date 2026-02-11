import React, { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertCircle, Wrench, CheckCircle2, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type Room } from "@/features/rooms/services/roomService";
import housekeepingService from "./services/housekeepingService";
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
      // Cargamos solo las que necesitan atención (Dirty o Cleaning)
      // O podríamos cargar todas si queremos una vista general.
      // Siguiendo el plan "vista para personal de limpieza", cargaremos las que necesitan limpieza.
      const data = await housekeepingService.getDirtyRooms();
      setRooms(data);
    } catch (error) {
      toast({
        title: "Error al cargar habitaciones",
        description: "No se pudo obtener la lista de limpieza.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const handleStartCleaning = async (roomId: string) => {
    try {
      await housekeepingService.startCleaning(roomId);
      toast({ title: "Limpieza iniciada", variant: "success" });
      loadRooms();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo iniciar la limpieza", variant: "error" });
    }
  };

  const handleFinishCleaning = async (roomId: string) => {
    try {
      await housekeepingService.finishCleaning(roomId);
      toast({ title: "Habitación lista", description: "Marcada como disponible", variant: "success" });
      loadRooms();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo finalizar la limpieza", variant: "error" });
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === (filter === "CLEANING" ? "Cleaning" : "Dirty");
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Cleaning":
        return {
          color: "bg-amber-50 text-amber-700 border-amber-200",
          icon: CheckCircle2,
          label: "En progreso",
          action: "Finalizar",
          onAction: handleFinishCleaning,
          btnIcon: Check,
          btnColor: "bg-emerald-600 hover:bg-emerald-700",
        };
      case "Dirty":
      default:
        return {
          color: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
          label: "Pendiente",
          action: "Empezar",
          onAction: handleStartCleaning,
          btnIcon: Play,
          btnColor: "bg-amber-600 hover:bg-amber-700",
        };
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Limpieza</h2>
          <p className="text-slate-500 font-medium mt-3">
            Atención prioritaria para habitaciones sucias.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Button
            variant={filter === "ALL" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest"
            onClick={() => setFilter("ALL")}
          >
            Todas ({rooms.length})
          </Button>
          <Button
            variant={filter === "DIRTY" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest text-rose-600"
            onClick={() => setFilter("DIRTY")}
          >
            Pendientes ({rooms.filter(r => r.status === 'Dirty').length})
          </Button>
          <Button
            variant={filter === "CLEANING" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-lg font-bold text-[10px] uppercase tracking-widest text-amber-600"
            onClick={() => setFilter("CLEANING")}
          >
            En Progreso ({rooms.filter(r => r.status === 'Cleaning').length})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-emerald-50 rounded-3xl border border-emerald-100 border-dashed">
          <Sparkles className="w-12 h-12 text-emerald-500 mb-4" />
          <h3 className="text-xl font-black text-emerald-900 tracking-tight">¡Todo está limpio!</h3>
          <p className="text-emerald-600 font-medium mt-1">No hay tareas pendientes en este momento.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRooms.map((room) => {
            const config = getStatusConfig(room.status);
            const StatusIcon = config.icon;
            const ActionIcon = config.btnIcon;

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

                  <Button
                    className={`w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-lg transition-all active:scale-95 ${config.btnColor}`}
                    onClick={() => config.onAction(room.id)}
                  >
                    <ActionIcon className="w-4 h-4 mr-2" />
                    {config.action}
                  </Button>
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
