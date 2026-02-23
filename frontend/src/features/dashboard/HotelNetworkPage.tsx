import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Globe,
  LineChart,
  Plus,
  TrendingUp,
} from "lucide-react";
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
import {
  createHotel,
  getFeatureFlags,
  getHotelNetworkKpis,
  getHotels,
  type HotelNetworkSummary,
  type TenantFeatureFlags,
  updateHotelPlanTier,
} from "@/features/dashboard/services/hotelService";
import { type Hotel } from "@/types/domain";
import { getErrorMessage } from "@/api/errors";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { useNavigate } from "react-router-dom";

type NetworkData = {
  hotels: Hotel[];
  summary: HotelNetworkSummary;
  flags: TenantFeatureFlags;
};

const toISODate = (value: Date) => value.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: toISODate(start),
    end: toISODate(end),
  };
};

const HotelNetworkPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newHotelLoading, setNewHotelLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [range, setRange] = useState(getDefaultRange);
  const [selectedHotelId, setSelectedHotelId] = useState<string>("all");
  const [planDraft, setPlanDraft] = useState<"BASIC" | "PRO" | "ENTERPRISE">("PRO");
  const [planUpdateLoading, setPlanUpdateLoading] = useState(false);

  const networkQueryKey = useMemo(
    () => `network:summary:${range.start}:${range.end}`,
    [range.end, range.start],
  );

  const {
    data,
    isLoading: loading,
    error: networkError,
    refetch: refetchNetwork,
    invalidate: invalidateNetwork,
  } = useResourceQuery<NetworkData>({
    queryKey: networkQueryKey,
    queryFn: async () => {
      const [hotels, summary, flags] = await Promise.all([
        getHotels(),
        getHotelNetworkKpis(range.start, range.end),
        getFeatureFlags(),
      ]);
      return { hotels, summary, flags };
    },
    staleTimeMs: 10_000,
  });

  const hotels = data?.hotels ?? [];
  const summary = data?.summary ?? null;
  const flags = data?.flags ?? null;

  const hotelsById = useMemo(() => {
    return hotels.reduce<Record<string, Hotel>>((acc, hotel) => {
      acc[hotel.id] = hotel;
      return acc;
    }, {});
  }, [hotels]);

  const enrichedHotelRows = useMemo(() => {
    const source = summary?.hotels ?? [];
    return source.map((item) => ({
      ...item,
      address: hotelsById[item.hotel_id]?.address ?? null,
    }));
  }, [hotelsById, summary?.hotels]);

  const visibleHotels = useMemo(() => {
    if (selectedHotelId === "all") return enrichedHotelRows;
    return enrichedHotelRows.filter((item) => item.hotel_id === selectedHotelId);
  }, [enrichedHotelRows, selectedHotelId]);

  const selectedHotelDetail = useMemo(() => {
    if (visibleHotels.length === 0) return null;
    return visibleHotels[0];
  }, [visibleHotels]);

  useEffect(() => {
    if (!selectedHotelDetail) return;
    setPlanDraft(selectedHotelDetail.plan_tier);
  }, [selectedHotelDetail]);

  const topByRevenue = useMemo(() => {
    if (enrichedHotelRows.length === 0) return null;
    return [...enrichedHotelRows].sort((a, b) => b.revenue_cents - a.revenue_cents)[0];
  }, [enrichedHotelRows]);

  const topByOccupancy = useMemo(() => {
    if (enrichedHotelRows.length === 0) return null;
    return [...enrichedHotelRows].sort((a, b) => b.occupancy_rate - a.occupancy_rate)[0];
  }, [enrichedHotelRows]);

  const handleCreateHotel = async (event: FormEvent) => {
    event.preventDefault();
    setNewHotelLoading(true);
    try {
      await createHotel(formData);
      toast({ title: "Éxito", description: "Nueva propiedad registrada en la red", variant: "success" });
      setIsCreateOpen(false);
      setFormData({ name: "", address: "" });
      invalidateNetwork();
      await refetchNetwork();
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

  const handleRangeChange = (field: "start" | "end", value: string) => {
    setRange((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleUpdatePlanTier = async () => {
    if (!selectedHotelDetail || selectedHotelId === "all") {
      toast({
        title: "Seleccioná una propiedad",
        description: "Elegí un hotel específico antes de actualizar el plan.",
        variant: "default",
      });
      return;
    }
    setPlanUpdateLoading(true);
    try {
      await updateHotelPlanTier(selectedHotelDetail.hotel_id, planDraft);
      toast({ title: "Plan actualizado", variant: "success" });
      invalidateNetwork();
      await refetchNetwork();
    } catch (error) {
      toast({
        title: "Error",
        description: getErrorMessage(error, "No se pudo actualizar el plan del hotel"),
        variant: "error",
      });
    } finally {
      setPlanUpdateLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-lg shadow-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">HQ Multi-Hotel</h2>
          </div>
          <p className="text-slate-500 font-medium mt-2">Consolidado por cadena con benchmark y drill-down por propiedad.</p>
          {flags ? (
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Plan actual tenant: {flags.plan_tier}
            </p>
          ) : null}
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 gap-2"
        >
          <Plus className="w-4 h-4" />
          Añadir Propiedad
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/60 rounded-3xl bg-white">
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="range-start">Desde</Label>
            <Input id="range-start" type="date" value={range.start} onChange={(event) => handleRangeChange("start", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="range-end">Hasta</Label>
            <Input id="range-end" type="date" value={range.end} onChange={(event) => handleRangeChange("end", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotel-filter">Propiedad</Label>
            <select
              id="hotel-filter"
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
              value={selectedHotelId}
              onChange={(event) => setSelectedHotelId(event.target.value)}
            >
              <option value="all">Todas</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-200 bg-white text-slate-700"
              onClick={() => void refetchNetwork()}
            >
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState label="Cargando consolidado HQ..." />
      ) : networkError ? (
        <ErrorState
          message={getErrorMessage(networkError, "No se pudo cargar el consolidado de cadena")}
          onRetry={() => void refetchNetwork()}
        />
      ) : !summary || summary.hotels.length === 0 ? (
        <EmptyState message="No hay propiedades con datos operativos para el período seleccionado." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Hoteles</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{summary.total_hotels}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ingresos red</p>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  ${(summary.total_revenue_cents / 100).toLocaleString("es-AR")}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reservas activas</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{summary.total_active_bookings}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="p-5">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ocupación promedio</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{summary.average_occupancy_rate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="rounded-3xl border border-slate-200 bg-white lg:col-span-2">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Benchmark entre propiedades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {visibleHotels.map((hotel) => (
                  <button
                    key={hotel.hotel_id}
                    type="button"
                    onClick={() => setSelectedHotelId(hotel.hotel_id)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{hotel.hotel_name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {hotel.address || "Dirección no registrada"}
                        </p>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        ${(hotel.revenue_cents / 100).toLocaleString("es-AR")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
                      <span>Plan: {hotel.plan_tier}</span>
                      <span>Occ: {hotel.occupancy_rate.toFixed(1)}%</span>
                      <span>ADR: ${(hotel.adr_cents / 100).toLocaleString("es-AR")}</span>
                      <span className="col-span-3">RevPAR: ${(hotel.rev_par_cents / 100).toLocaleString("es-AR")}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg font-black text-slate-900">Drill-down</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                {selectedHotelDetail ? (
                  <>
                    <div>
                      <p className="text-sm font-black text-slate-900">{selectedHotelDetail.hotel_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedHotelDetail.address || "Sin dirección"}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Plan: {selectedHotelDetail.plan_tier}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="font-black uppercase tracking-widest text-slate-400">Ocupación</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          {selectedHotelDetail.occupancy_rate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="font-black uppercase tracking-widest text-slate-400">Reservas</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{selectedHotelDetail.active_bookings_count}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="font-black uppercase tracking-widest text-slate-400">ADR</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          ${(selectedHotelDetail.adr_cents / 100).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="font-black uppercase tracking-widest text-slate-400">RevPAR</p>
                        <p className="mt-1 text-lg font-black text-slate-900">
                          ${(selectedHotelDetail.rev_par_cents / 100).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-tier">Plan comercial</Label>
                      <select
                        id="plan-tier"
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
                        value={planDraft}
                        onChange={(event) =>
                          setPlanDraft(event.target.value as "BASIC" | "PRO" | "ENTERPRISE")
                        }
                        disabled={selectedHotelId === "all"}
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-slate-200"
                        disabled={selectedHotelId === "all" || planUpdateLoading}
                        onClick={() => void handleUpdatePlanTier()}
                      >
                        {planUpdateLoading ? "Actualizando..." : "Actualizar plan"}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      className="w-full rounded-xl bg-slate-900"
                      onClick={() => navigate("/reports")}
                    >
                      Abrir Reportes <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <EmptyState message="Seleccioná una propiedad para ver el detalle." className="py-6" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="flex items-center gap-3 p-5">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Top revenue</p>
                  <p className="text-sm font-black text-slate-900">
                    {topByRevenue ? `${topByRevenue.hotel_name} · $${(topByRevenue.revenue_cents / 100).toLocaleString("es-AR")}` : "Sin datos"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="flex items-center gap-3 p-5">
                <LineChart className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Top ocupación</p>
                  <p className="text-sm font-black text-slate-900">
                    {topByOccupancy ? `${topByOccupancy.hotel_name} · ${topByOccupancy.occupancy_rate.toFixed(1)}%` : "Sin datos"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
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
