import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Building2, Globe, MapPin, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/async-state";
import { useToast } from "@/components/ui/toast";
import { createHotel, getHotels } from "@/features/dashboard/services/hotelService";
import { type Hotel } from "@/types/domain";
import { getErrorMessage } from "@/api/errors";
import { useResourceQuery } from "@/lib/useResourceQuery";

const HOTELS_QUERY_KEY = "network:hotels";

const HotelNetworkPage = () => {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newHotelLoading, setNewHotelLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const {
    data: hotelsData,
    isLoading: loading,
    error: hotelsError,
    refetch: refetchHotels,
    invalidate: invalidateHotels,
  } = useResourceQuery<Hotel[]>({
    queryKey: HOTELS_QUERY_KEY,
    queryFn: getHotels,
    staleTimeMs: 10_000,
  });

  const hotels = useMemo(() => hotelsData ?? [], [hotelsData]);

  const handleCreateHotel = async (event: FormEvent) => {
    event.preventDefault();
    setNewHotelLoading(true);
    try {
      await createHotel(formData);
      toast({ title: "Éxito", description: "Nueva propiedad registrada en la red", variant: "success" });
      setIsCreateOpen(false);
      setFormData({ name: "", address: "" });
      invalidateHotels();
      await refetchHotels();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo registrar el hotel"),
        variant: "error",
      });
    } finally {
      setNewHotelLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-lg shadow-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Red de Propiedades</h2>
          </div>
          <p className="text-slate-500 font-medium mt-2">Gestión centralizada de la cadena hotelera (SuperAdmin).</p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 gap-2"
        >
          <Plus className="w-4 h-4" />
          Añadir Propiedad
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Cargando red..." />
      ) : hotelsError ? (
        <ErrorState
          message={getErrorMessage(hotelsError, "No se pudo cargar la red de hoteles")}
          onRetry={() => void refetchHotels()}
        />
      ) : hotels.length === 0 ? (
        <EmptyState message="No hay propiedades registradas todavía." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {hotels.map((hotel) => (
            <Card
              key={hotel.id}
              className="border-none shadow-2xl shadow-slate-200/50 rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300"
            >
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-900">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <Badge variant={hotel.id === "00000000-0000-0000-0000-000000000001" ? "info" : "outline"}>
                    {hotel.id === "00000000-0000-0000-0000-000000000001" ? "Sede Central" : "Sucursal"}
                  </Badge>
                </div>
                <CardTitle className="text-xl font-black text-slate-900 mt-4">{hotel.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-3 text-slate-500">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">{hotel.address || "Sin dirección registrada"}</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Activo</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-indigo-600 font-bold gap-2 hover:bg-indigo-50">
                    Gestionar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="bg-white">
          <SheetHeader className="border-b pb-6">
            <SheetTitle className="text-2xl font-black">Nueva Propiedad</SheetTitle>
            <SheetDescription>Registra un nuevo hotel en la red global.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateHotel} className="py-8 space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del Hotel</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                  className="rounded-xl h-12"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Dirección Física</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  className="rounded-xl h-12"
                />
              </div>
            </div>

            <SheetFooter className="pt-6 border-t">
              <Button type="submit" disabled={newHotelLoading} className="w-full h-12 rounded-xl bg-slate-900">
                {newHotelLoading ? "Guardando..." : "Dar de Alta Propiedad"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default HotelNetworkPage;
