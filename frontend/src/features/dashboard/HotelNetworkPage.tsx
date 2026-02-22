import { useMemo, useState } from "react";
import {
  Building2,
  Crown,
  Filter,
  Globe,
  Loader2,
  Plus,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/api/errors";
import { useResourceQuery } from "@/lib/useResourceQuery";
import { downloadCSV } from "@/lib/utils";
import { withRetry } from "@/lib/retry";
import { createHotel, getHotels, updateHotelPlanTier } from "./services/hotelService";
import {
  getHotelNetworkSummary,
  type HotelNetworkSummary,
  type HotelNetworkHotelSummary,
} from "./services/networkService";
import { useAuth } from "@/features/auth/useAuth";
import { roleHasCapability } from "@/features/auth/capabilities";
import type { Hotel, PlanTier } from "@/types/domain";

const HOTELS_QUERY_KEY = "network:hotels";

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

type RankingSort = "revenue" | "occupancy" | "revpar" | "bookings";

const HotelNetworkPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newHotelLoading, setNewHotelLoading] = useState(false);
  const [planSavingHotelId, setPlanSavingHotelId] = useState<string | null>(null);
  const [planDraftByHotel, setPlanDraftByHotel] = useState<Record<string, PlanTier>>({});
  const [sortBy, setSortBy] = useState<RankingSort>("revenue");
  const [formData, setFormData] = useState({ name: "", address: "" });

  const [draftStart, setDraftStart] = useState(formatDateInput(thirtyDaysAgo));
  const [draftEnd, setDraftEnd] = useState(formatDateInput(today));
  const [draftHotelId, setDraftHotelId] = useState("");

  const [filters, setFilters] = useState({
    start: formatDateInput(thirtyDaysAgo),
    end: formatDateInput(today),
    hotelId: "",
  });

  const {
    data: hotelsData,
    isLoading: hotelsLoading,
    error: hotelsError,
    refetch: refetchHotels,
  } = useResourceQuery<Hotel[]>({
    queryKey: HOTELS_QUERY_KEY,
    queryFn: getHotels,
    staleTimeMs: 20_000,
  });

  const summaryQueryKey = useMemo(
    () => `network:summary:${filters.start}:${filters.end}:${filters.hotelId || "all"}`,
    [filters.end, filters.hotelId, filters.start],
  );
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useResourceQuery<HotelNetworkSummary>({
    queryKey: summaryQueryKey,
    queryFn: () =>
      getHotelNetworkSummary({
        start: filters.start,
        end: filters.end,
        hotelId: filters.hotelId || undefined,
      }),
    staleTimeMs: 15_000,
  });

  const hotels = useMemo(() => hotelsData ?? [], [hotelsData]);
  const summary = summaryData;

  const rankedHotels = useMemo(() => {
    if (!summary) return [];
    const copy = [...summary.hotels];
    switch (sortBy) {
      case "occupancy":
        return copy.sort((a, b) => b.occupancy_rate - a.occupancy_rate);
      case "revpar":
        return copy.sort((a, b) => b.rev_par_cents - a.rev_par_cents);
      case "bookings":
        return copy.sort((a, b) => b.bookings_count - a.bookings_count);
      case "revenue":
      default:
        return copy.sort((a, b) => b.revenue_cents - a.revenue_cents);
    }
  }, [sortBy, summary]);

  const selectedHotel = useMemo(() => {
    if (!summary || summary.hotels.length === 0) return null;
    if (filters.hotelId) {
      return summary.hotels.find((hotel) => hotel.hotel_id === filters.hotelId) ?? null;
    }
    return rankedHotels[0] ?? null;
  }, [filters.hotelId, rankedHotels, summary]);
  const selectedHotelPlanDraft: PlanTier = selectedHotel
    ? planDraftByHotel[selectedHotel.hotel_id] ?? selectedHotel.plan_tier
    : "BASIC";
  const canUpdatePlan = roleHasCapability(user?.role, "saas.hotels.write");

  const benchmarkHotelName = (
    hotelsMetrics: HotelNetworkHotelSummary[],
    hotelId: string | null,
  ): string => {
    if (!hotelId) return "Sin datos";
    return hotelsMetrics.find((hotel) => hotel.hotel_id === hotelId)?.hotel_name ?? "N/D";
  };

  const handleApplyFilters = () => {
    if (!draftStart || !draftEnd) {
      toast({
        title: "Rango inválido",
        description: "Debes completar fecha inicial y final.",
        variant: "error",
      });
      return;
    }
    if (draftStart > draftEnd) {
      toast({
        title: "Rango inválido",
        description: "La fecha inicial no puede ser mayor que la final.",
        variant: "error",
      });
      return;
    }
    setFilters({
      start: draftStart,
      end: draftEnd,
      hotelId: draftHotelId,
    });
  };

  const handleResetFilters = () => {
    const defaultStart = formatDateInput(thirtyDaysAgo);
    const defaultEnd = formatDateInput(today);
    setDraftStart(defaultStart);
    setDraftEnd(defaultEnd);
    setDraftHotelId("");
    setFilters({
      start: defaultStart,
      end: defaultEnd,
      hotelId: "",
    });
  };

  const handleCreateHotel = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewHotelLoading(true);
    try {
      await withRetry(() => createHotel(formData), { retries: 1 });
      toast({
        title: "Propiedad creada",
        description: "La nueva propiedad ya forma parte de la red.",
        variant: "success",
      });
      setFormData({ name: "", address: "" });
      setIsCreateOpen(false);
      await refetchHotels();
      await refetchSummary();
    } catch (error: unknown) {
      toast({
        title: "No se pudo crear la propiedad",
        description: getErrorMessage(error, "Revisa los datos e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      setNewHotelLoading(false);
    }
  };

  const handleExportBenchmark = () => {
    if (!summary || summary.hotels.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar en este rango.",
        variant: "default",
      });
      return;
    }
    downloadCSV(
      summary.hotels.map((hotel) => ({
        hotel_name: hotel.hotel_name,
        hotel_address: hotel.hotel_address ?? "",
        revenue_cents: hotel.revenue_cents,
        bookings_count: hotel.bookings_count,
        occupancy_rate: Number(hotel.occupancy_rate.toFixed(2)),
        adr_cents: hotel.adr_cents,
        rev_par_cents: hotel.rev_par_cents,
        active_bookings_count: hotel.active_bookings_count,
        today_check_ins: hotel.today_check_ins,
      })),
      `hq-benchmark-${filters.start}-a-${filters.end}.csv`,
    );
    toast({
      title: "Exportación lista",
      description: "Benchmark exportado en CSV.",
      variant: "success",
    });
  };

  const handleUpdateSelectedHotelPlan = async () => {
    if (!selectedHotel) return;
    setPlanSavingHotelId(selectedHotel.hotel_id);
    try {
      await withRetry(
        () => updateHotelPlanTier(selectedHotel.hotel_id, selectedHotelPlanDraft),
        { retries: 1 },
      );
      toast({
        title: "Plan actualizado",
        description: `${selectedHotel.hotel_name} ahora opera con plan ${selectedHotelPlanDraft}.`,
        variant: "success",
      });
      await refetchHotels();
      await refetchSummary();
    } catch (error: unknown) {
      toast({
        title: "No se pudo actualizar el plan",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    } finally {
      setPlanSavingHotelId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-xl bg-slate-900 p-2 text-white dark:bg-slate-100 dark:text-slate-900">
              <Globe className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              HQ Multi-Hotel
            </h2>
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Vista consolidada por cadena con drill-down por propiedad y benchmark de desempeño.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={handleExportBenchmark}
            disabled={summaryLoading}
          >
            Exportar Benchmark
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Nueva Propiedad
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            Filtros HQ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-1.5">
            <Label htmlFor="hq-start">Desde</Label>
            <Input
              id="hq-start"
              type="date"
              value={draftStart}
              onChange={(event) => setDraftStart(event.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hq-end">Hasta</Label>
            <Input
              id="hq-end"
              type="date"
              value={draftEnd}
              onChange={(event) => setDraftEnd(event.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="grid gap-1.5 xl:col-span-2">
            <Label htmlFor="hq-hotel">Propiedad</Label>
            <select
              id="hq-hotel"
              value={draftHotelId}
              onChange={(event) => setDraftHotelId(event.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Toda la red</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="h-10 flex-1 rounded-xl" onClick={handleApplyFilters}>
              Aplicar
            </Button>
            <Button variant="outline" className="h-10 rounded-xl" onClick={handleResetFilters}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {(hotelsError || summaryError) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
          {summaryError || hotelsError}
        </div>
      )}

      {(hotelsLoading || summaryLoading) && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando vista HQ...
        </div>
      )}

      {!summaryLoading && summary && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Revenue Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ${(summary.totals.revenue_cents / 100).toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summary.totals.hotels_count} propiedades en período
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Ocupación Prom.
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-300">
                  {summary.totals.avg_occupancy_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summary.totals.bookings_count} reservas en rango
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  ADR Promedio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ${(summary.totals.avg_adr_cents / 100).toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  RevPAR ${(summary.totals.avg_rev_par_cents / 100).toLocaleString("es-AR")}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Operación Hoy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-indigo-600 dark:text-indigo-300">
                  {summary.totals.today_check_ins}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  check-ins, {summary.totals.active_bookings_count} activas
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200 xl:col-span-2 dark:border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold">Benchmark entre Hoteles</CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ranking-sort" className="text-xs text-slate-500">
                    Orden
                  </Label>
                  <select
                    id="ranking-sort"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as RankingSort)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="occupancy">Ocupación</option>
                    <option value="revpar">RevPAR</option>
                    <option value="bookings">Reservas</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankedHotels.map((hotel, index) => (
                  <div
                    key={hotel.hotel_id}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="col-span-1 text-center text-xs font-black text-slate-500 dark:text-slate-300">
                      {index + 1}
                    </div>
                    <div className="col-span-4 min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                        {hotel.hotel_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {hotel.hotel_address ?? "Sin dirección"}
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px] font-black">
                        {hotel.plan_tier}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                      ${(hotel.revenue_cents / 100).toLocaleString("es-AR")}
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {hotel.occupancy_rate.toFixed(1)}%
                    </div>
                    <div className="col-span-1 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {hotel.bookings_count}
                    </div>
                    <div className="col-span-2 text-right text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      ${(hotel.rev_par_cents / 100).toLocaleString("es-AR")}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base font-bold">Benchmarks de Red</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">
                    <Trophy className="h-3.5 w-3.5" /> Top Revenue
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {benchmarkHotelName(summary.hotels, summary.benchmarks.top_revenue_hotel_id)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-900/20">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                    <TrendingUp className="h-3.5 w-3.5" /> Top Ocupación
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {benchmarkHotelName(summary.hotels, summary.benchmarks.top_occupancy_hotel_id)}
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-700 dark:bg-indigo-900/20">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-200">
                    <Crown className="h-3.5 w-3.5" /> Top RevPAR
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {benchmarkHotelName(summary.hotels, summary.benchmarks.top_rev_par_hotel_id)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedHotel && (
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    Drill-down: {selectedHotel.hotel_name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Período {summary.start} a {summary.end}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  <Building2 className="mr-1 h-3 w-3" />
                  {filters.hotelId ? "Propiedad filtrada" : "Top actual"}
                </Badge>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <MetricDeltaCard
                  label="Revenue"
                  value={`$${(selectedHotel.revenue_cents / 100).toLocaleString("es-AR")}`}
                  delta={percentageDelta(selectedHotel.revenue_cents, summary.totals.revenue_cents)}
                />
                <MetricDeltaCard
                  label="Ocupación"
                  value={`${selectedHotel.occupancy_rate.toFixed(1)}%`}
                  delta={deltaVsAverage(selectedHotel.occupancy_rate, summary.totals.avg_occupancy_rate)}
                  deltaSuffix="pp"
                />
                <MetricDeltaCard
                  label="ADR"
                  value={`$${(selectedHotel.adr_cents / 100).toLocaleString("es-AR")}`}
                  delta={deltaVsAverage(selectedHotel.adr_cents, summary.totals.avg_adr_cents)}
                />
                <MetricDeltaCard
                  label="RevPAR"
                  value={`$${(selectedHotel.rev_par_cents / 100).toLocaleString("es-AR")}`}
                  delta={deltaVsAverage(selectedHotel.rev_par_cents, summary.totals.avg_rev_par_cents)}
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:col-span-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Plan Comercial
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="grid flex-1 gap-1.5">
                      <Label htmlFor="hotel-plan-tier">Tier activo</Label>
                      <select
                        id="hotel-plan-tier"
                        value={selectedHotelPlanDraft}
                        onChange={(event) =>
                          setPlanDraftByHotel((previous) => ({
                            ...previous,
                            [selectedHotel.hotel_id]: event.target.value as PlanTier,
                          }))
                        }
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        disabled={!canUpdatePlan}
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      className="h-10 rounded-xl"
                      onClick={handleUpdateSelectedHotelPlan}
                      disabled={
                        !canUpdatePlan ||
                        planSavingHotelId === selectedHotel.hotel_id ||
                        selectedHotelPlanDraft === selectedHotel.plan_tier
                      }
                    >
                      {planSavingHotelId === selectedHotel.hotel_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Actualizar Plan"
                      )}
                    </Button>
                  </div>
                  {!canUpdatePlan ? (
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Tu rol actual no tiene permiso para modificar planes.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="bg-white dark:bg-slate-900">
          <SheetHeader className="border-b pb-6">
            <SheetTitle className="text-2xl font-black">Nueva Propiedad</SheetTitle>
            <SheetDescription>Registrar hotel para consolidación HQ.</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateHotel} className="space-y-6 py-8">
            <div className="grid gap-2">
              <Label htmlFor="hotel-name">Nombre del Hotel</Label>
              <Input
                id="hotel-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, name: event.target.value }))
                }
                className="h-11 rounded-xl"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hotel-address">Dirección</Label>
              <Input
                id="hotel-address"
                value={formData.address}
                onChange={(event) =>
                  setFormData((previous) => ({ ...previous, address: event.target.value }))
                }
                className="h-11 rounded-xl"
              />
            </div>

            <SheetFooter className="border-t pt-6">
              <Button
                type="submit"
                disabled={newHotelLoading}
                className="h-11 w-full rounded-xl bg-slate-900 text-white hover:text-white"
              >
                {newHotelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear Propiedad"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const percentageDelta = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return (value / total) * 100;
};

const deltaVsAverage = (value: number, average: number): number => {
  return value - average;
};

const MetricDeltaCard = ({
  label,
  value,
  delta,
  deltaSuffix = "%",
}: {
  label: string;
  value: string;
  delta: number;
  deltaSuffix?: string;
}) => {
  const positive = delta >= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{value}</p>
      <p
        className={`text-xs font-semibold ${positive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}
      >
        {positive ? "+" : ""}
        {delta.toFixed(1)}
        {deltaSuffix}
      </p>
    </div>
  );
};

export default HotelNetworkPage;
