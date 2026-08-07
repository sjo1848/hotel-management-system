import { useContext, useEffect, useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { invalidateResource, useResourceQuery } from "@/lib/useResourceQuery";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { getErrorMessage } from "@/api/errors";
import { AuthContext } from "@/features/auth/AuthContext";
import { roleHasCapability } from "@/features/auth/capabilities";
import { useGuidedMode } from "@/features/guided/GuidedModeContext";
import CompactGuideAssistant from "@/features/guided/components/CompactGuideAssistant";
import { finishCleaning, getHousekeepingBoard, returnRoomToDirty, sendRoomToMaintenance, startCleaning } from "./services/housekeepingService";
import type { HousekeepingBoard } from "@/types/domain";
import HousekeepingRoomWorkspace from "./components/HousekeepingRoomWorkspace";
import { buildHousekeepingQueue, filterHousekeepingQueue, operationalDate, type HousekeepingFilter } from "./housekeepingQueue";

const FILTERS: Array<{ id: HousekeepingFilter; label: string }> = [{ id: "shift", label: "Turno" }, { id: "dirty", label: "Por limpiar" }, { id: "cleaning", label: "En limpieza" }, { id: "available", label: "Listas" }, { id: "maintenance", label: "Mantenimiento" }];

const HousekeepingPage = () => {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  const canWrite = roleHasCapability(user?.role, "housekeeping.write");
  const { enabled: guideEnabled, setEnabled, resetHousekeepingGuide, trackHousekeepingEvent, getHousekeepingGuideState } = useGuidedMode();
  const [day, setDay] = useState(operationalDate());
  const [filter, setFilter] = useState<HousekeepingFilter>("shift");
  const [search, setSearch] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const boardKey = `housekeeping:board:${day}`;
  const query = useResourceQuery<HousekeepingBoard>({ queryKey: boardKey, queryFn: () => getHousekeepingBoard(day), retry: false, staleTimeMs: 10_000 });

  useEffect(() => {
    const refreshDay = () => setDay(operationalDate());
    window.addEventListener("focus", refreshDay);
    document.addEventListener("visibilitychange", refreshDay);
    return () => { window.removeEventListener("focus", refreshDay); document.removeEventListener("visibilitychange", refreshDay); };
  }, []);

  const queue = useMemo(() => buildHousekeepingQueue(query.data?.rooms ?? [], query.data?.departures_today ?? []), [query.data]);
  const visibleQueue = useMemo(() => filterHousekeepingQueue(queue, filter, search), [filter, queue, search]);
  const selected = visibleQueue.find((room) => room.room_id === selectedRoomId) ?? queue.find((room) => room.room_id === selectedRoomId) ?? null;
  const counts = useMemo(() => ({ shift: queue.length, dirty: queue.filter((room) => room.room_status === "Dirty").length, cleaning: queue.filter((room) => room.room_status === "Cleaning").length, available: queue.filter((room) => room.room_status === "Available").length, maintenance: queue.filter((room) => room.room_status === "Maintenance").length }), [queue]);
  const guide = getHousekeepingGuideState({ pendingTurnover: counts.dirty, inProgress: counts.cleaning, ready: counts.available, blocked: counts.maintenance });
  const run = async (key: string, action: () => Promise<unknown>, title: string, event?: "start_cleaning" | "finish_cleaning" | "handle_blocker") => {
    if (!canWrite || loadingAction) return;
    setLoadingAction(key);
    try { await action(); if (event) trackHousekeepingEvent(event); toast({ title, variant: "success" }); invalidateResource(boardKey); await query.refetch(); } catch (error) { toast({ title: "No se pudo actualizar", description: getErrorMessage(error, "Reintenta en unos segundos."), variant: "error" }); } finally { setLoadingAction(null); }
  };
  const selectGuideStep = (stepId: string) => { const map: Record<string, HousekeepingFilter> = { "review-board": "shift", "start-cleaning": "dirty", "finish-cleaning": "cleaning", "handle-blocker": "maintenance" }; const nextFilter = map[stepId]; if (nextFilter) setFilter(nextFilter); const candidate = filterHousekeepingQueue(queue, nextFilter ?? "shift", "")[0]; if (candidate) { setSelectedRoomId(candidate.room_id); requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-label="Ver tarea habitación ${candidate.room_number}"]`)?.focus()); } };
  const closeRoom = () => { const roomNumber = selected?.room_number; setSelectedRoomId(null); if (roomNumber) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-label="Ver tarea habitación ${roomNumber}"]`)?.focus()); };
  return <div className="space-y-5">
    <PageHeader title="Housekeeping" description="Limpieza, liberación de inventario y mantenimiento" icon={<Sparkles className="h-5 w-5" />} actions={<div className="flex flex-wrap gap-2"><span className="self-center rounded-xl bg-muted px-3 py-2 text-sm font-semibold">{format(startOfToday(), "EEEE d 'de' MMMM", { locale: es })}</span><Button type="button" variant="outline" className="min-h-11" disabled={query.isLoading} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" />Actualizar</Button></div>} />
    {guideEnabled ? <CompactGuideAssistant title={guide.summary.title} description={guide.summary.description} completed={guide.summary.completed} total={guide.summary.total} steps={guide.steps} ctaLabel={guide.steps.find((step) => step.active)?.actionLabel ?? "Continuar guía"} onCta={() => selectGuideStep(guide.steps.find((step) => step.active)?.id ?? "review-board")} onReset={resetHousekeepingGuide} onStepSelect={selectGuideStep} /> : null}
    <Button type="button" variant="outline" className="min-h-11" onClick={() => setEnabled(!guideEnabled)}>{guideEnabled ? "Deshabilitar guía" : "Habilitar guía"}</Button>
    <SectionCard className="space-y-4">
      <div role="group" className="flex flex-wrap gap-2" aria-label="Filtros de Housekeeping">{FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold ${filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{item.label} <span className="ml-1 rounded-full bg-background/40 px-1.5 py-0.5 text-xs">{counts[item.id]}</span></button>)}</div>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar habitación, tipo o huésped" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar habitación, tipo o huésped" className="min-h-11 pl-9" /></div><span className="self-center text-sm font-semibold text-muted-foreground">Salidas de hoy: {query.data?.departures_today.length ?? 0}</span></div>
      {query.error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">No se pudo cargar el turno de Housekeeping <Button type="button" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
      {query.isLoading ? <div role="status" className="space-y-2" aria-label="Cargando turno"><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /></div> : null}
      {!query.isLoading && !query.error && visibleQueue.length > 0 ? isDesktop ? <div className="grid content-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]"><ol className="space-y-2 xl:max-h-[calc(100vh-22rem)] xl:overflow-y-auto">{visibleQueue.map((item) => { const isSelected = item.room_id === selected?.room_id; const roomLabel = item.room_status === "Dirty" ? "Por limpiar" : item.room_status === "Cleaning" ? "En limpieza" : item.room_status === "Available" ? "Lista" : "Mantenimiento"; return (<li key={item.room_id}><button type="button" aria-label={`Ver tarea habitación ${item.room_number}`} aria-current={isSelected ? "true" : undefined} onClick={() => setSelectedRoomId(isSelected ? null : item.room_id)} className={`min-h-[76px] w-full rounded-xl border p-4 text-left ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">Habitación {item.room_number} · {item.room_type}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{roomLabel}{item.turnover_today ? " · Salida de hoy" : ""}</p>{item.departure ? <p className="mt-1 text-xs text-foreground">Huésped: {item.departure.guest_name}</p> : null}</div><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{item.isBlocked ? "Atención" : "Turno"}</span></div></button></li>); })}</ol><SectionCard className="min-h-[520px] overflow-hidden p-0"><HousekeepingRoomWorkspace item={selected} canWrite={canWrite} loadingAction={loadingAction} onClose={closeRoom} onStart={(id) => void run(`${id}:start`, () => startCleaning(id), "Limpieza iniciada", "start_cleaning")} onFinish={(id) => void run(`${id}:finish`, () => finishCleaning(id), "Limpieza finalizada", "finish_cleaning")} onOpenMaintenance={(id, payload) => void run(`${id}:maintenance`, () => sendRoomToMaintenance(id, payload), "Incidencia abierta", "handle_blocker")} onResolveMaintenance={(id, payload) => void run(`${id}:resolve`, () => returnRoomToDirty(id, payload), "Mantenimiento resuelto", "handle_blocker")} /></SectionCard></div> : <ol className="space-y-2">{visibleQueue.map((item) => { const isSelected = item.room_id === selected?.room_id; const roomLabel = item.room_status === "Dirty" ? "Por limpiar" : item.room_status === "Cleaning" ? "En limpieza" : item.room_status === "Available" ? "Lista" : "Mantenimiento"; return (<li key={item.room_id} className="space-y-2"><button type="button" aria-label={`Ver tarea habitación ${item.room_number}`} aria-expanded={isSelected} onClick={() => setSelectedRoomId(isSelected ? null : item.room_id)} className={`min-h-[76px] w-full rounded-xl border p-4 text-left ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black">Habitación {item.room_number} · {item.room_type}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{roomLabel}{item.turnover_today ? " · Salida de hoy" : ""}</p>{item.departure ? <p className="mt-1 text-xs text-foreground">Huésped: {item.departure.guest_name}</p> : null}</div><span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase">{item.isBlocked ? "Atención" : "Turno"}</span></div></button>{isSelected ? <div><HousekeepingRoomWorkspace item={item} canWrite={canWrite} loadingAction={loadingAction} onClose={closeRoom} onStart={(id) => void run(`${id}:start`, () => startCleaning(id), "Limpieza iniciada", "start_cleaning")} onFinish={(id) => void run(`${id}:finish`, () => finishCleaning(id), "Limpieza finalizada", "finish_cleaning")} onOpenMaintenance={(id, payload) => void run(`${id}:maintenance`, () => sendRoomToMaintenance(id, payload), "Incidencia abierta", "handle_blocker")} onResolveMaintenance={(id, payload) => void run(`${id}:resolve`, () => returnRoomToDirty(id, payload), "Mantenimiento resuelto", "handle_blocker")} /></div> : null}</li>); })}</ol> : null}
    </SectionCard>
  </div>;
};

export default HousekeepingPage;
