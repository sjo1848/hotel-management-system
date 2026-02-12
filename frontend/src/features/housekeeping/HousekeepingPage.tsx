import { useEffect, useState } from "react";
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDirtyRooms, startCleaning, finishCleaning } from "./services/housekeepingService";
import { Room } from "@/types/domain";
import { useToast } from "@/components/ui/toast";

const HousekeepingPage = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDirtyRooms = async () => {
    setLoading(true);
    try {
      const data = await getDirtyRooms();
      setRooms(data);
    } catch (error) {
      console.error("Failed to fetch dirty rooms", error);
      toast({ 
        title: "Error", 
        description: "No se pudo cargar la lista de limpieza", 
        variant: "error" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirtyRooms();
  }, []);

  const handleStartCleaning = async (roomId: string) => {
    setActionLoading(roomId);
    try {
      await startCleaning(roomId);
      toast({ title: "Limpieza iniciada", variant: "success" });
      fetchDirtyRooms();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo iniciar la limpieza", variant: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinishCleaning = async (roomId: string) => {
    setActionLoading(roomId);
    try {
      await finishCleaning(roomId);
      toast({ title: "Habitación lista", description: "Marcada como disponible", variant: "success" });
      fetchDirtyRooms();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo finalizar la limpieza", variant: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg shadow-lg shadow-orange-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
              Limpieza y Estado
            </h2>
          </div>
          <p className="text-slate-500 font-medium mt-2">
            Gestión de habitaciones pendientes de limpieza o en proceso.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mr-3" />
          Cargando habitaciones...
        </div>
      ) : rooms.length === 0 ? (
        <Card className="border-none shadow-xl bg-emerald-50/50 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <CardTitle className="text-emerald-900 font-black">¡Todo impecable!</CardTitle>
          <p className="text-emerald-700 mt-2 max-w-sm">No hay habitaciones pendientes de limpieza en este momento.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <Card key={room.id} className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group hover:shadow-2xl transition-all">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-mono font-bold">
                    {room.room_number}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{room.room_type}</div>
                  </div>
                </div>
                <Badge variant={room.status === "Cleaning" ? "info" : "warning"}>
                  {room.status === "Cleaning" ? "En proceso" : "Sucia"}
                </Badge>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium">Requiere atención inmediata</span>
                  </div>
                  
                  {room.status === "Dirty" ? (
                    <Button 
                      className="w-full h-12 bg-slate-900 rounded-xl shadow-lg transition-all active:scale-95"
                      onClick={() => handleStartCleaning(room.id)}
                      disabled={actionLoading === room.id}
                    >
                      {actionLoading === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      Iniciar Limpieza
                    </Button>
                  ) : (
                    <Button 
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg transition-all active:scale-95"
                      onClick={() => handleFinishCleaning(room.id)}
                      disabled={actionLoading === room.id}
                    >
                      {actionLoading === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Finalizar y Habilitar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HousekeepingPage;
