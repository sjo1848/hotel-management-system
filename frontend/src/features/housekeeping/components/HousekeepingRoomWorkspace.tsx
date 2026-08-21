import { useEffect, useState, type KeyboardEvent } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HousekeepingQueueItem } from "../housekeepingQueue";
import type { MarkMaintenanceInput, ResolveMaintenanceInput } from "@/types/domain";
import MaintenanceCaseActions from "./MaintenanceCaseActions";

type Props = {
  item: HousekeepingQueueItem | null;
  canWrite: boolean;
  loadingAction: string | null;
  onStart: (roomId: string) => void;
  onFinish: (roomId: string) => void;
  onOpenMaintenance: (roomId: string, payload: MarkMaintenanceInput) => void;
  onResolveMaintenance: (roomId: string, payload: ResolveMaintenanceInput) => void;
  onClose: () => void;
  initialTab?: "summary" | "action" | "maintenance";
};

const HousekeepingRoomWorkspace = ({ item, canWrite, loadingAction, onStart, onFinish, onOpenMaintenance, onResolveMaintenance, onClose, initialTab = "summary" }: Props) => {
  const [tab, setTab] = useState<"summary" | "action" | "maintenance">(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  if (!item) return <div className="flex min-h-64 items-center justify-center p-6 text-sm text-muted-foreground">Seleccioná una habitación para ver su tarea.</div>;
  const loading = loadingAction?.startsWith(`${item.room_id}:`) ?? false;
  const status = item.room_status === "Dirty" ? "Por limpiar" : item.room_status === "Cleaning" ? "En limpieza" : item.room_status === "Available" ? "Lista" : "Mantenimiento";
  const availableTabs: Array<"summary" | "action" | "maintenance"> = item.room_status === "Maintenance" || canWrite ? ["summary", "action", "maintenance"] : ["summary", "action"];
  const selectTabFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, current: "summary" | "action" | "maintenance") => {
    const index = availableTabs.indexOf(current);
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % availableTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + availableTabs.length) % availableTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = availableTabs.length - 1;
    else return;
    event.preventDefault();
    const next = availableTabs[nextIndex];
    setTab(next);
    document.getElementById(`housekeeping-${item.room_id}-tab-${next}`)?.focus();
  };
  return <div className="flex max-h-[70vh] min-h-[200px] flex-col rounded-2xl border border-border bg-card shadow-sm md:max-h-none md:shadow-none">
    <div className="border-b border-border px-5 py-4 sm:py-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Detalle de tarea</p><h2 className="mt-1 text-xl font-black">Habitación {item.room_number}</h2><p className="mt-1 text-sm text-muted-foreground">{item.room_type} · {status}{item.turnover_today ? " · Salida de hoy" : ""}</p></div><button type="button" aria-label="Cerrar detalle" className="min-h-11 min-w-11 rounded-xl border border-border md:hidden" onClick={onClose}><X className="mx-auto h-4 w-4" /></button></div></div>
    <div role="tablist" aria-label="Secciones de la habitación" className="flex gap-1 border-b border-border bg-muted/40 p-1">{availableTabs.map((availableTab) => <button key={availableTab} id={`housekeeping-${item.room_id}-tab-${availableTab}`} role="tab" aria-controls={`housekeeping-${item.room_id}-panel-${availableTab}`} aria-selected={tab === availableTab} tabIndex={tab === availableTab ? 0 : -1} type="button" className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${tab === availableTab ? "bg-card shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab(availableTab)} onKeyDown={(event) => selectTabFromKeyboard(event, availableTab)}>{availableTab === "summary" ? "Resumen" : availableTab === "action" ? "Acción" : "Mantenimiento"}</button>)}</div>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div id={`housekeeping-${item.room_id}-panel-summary`} role="tabpanel" aria-labelledby={`housekeeping-${item.room_id}-tab-summary`} hidden={tab !== "summary"} className="space-y-4"><div className="rounded-2xl border border-border bg-muted/40 p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado actual</p><p className="mt-2 text-lg font-black">{status}</p>{item.departure ? <p className="mt-2 text-sm text-foreground">Salida de hoy · {item.departure.guest_name} · {item.departure.booking_status}</p> : null}{item.isBlocked ? <p className="mt-2 text-sm font-semibold text-amber-800">Todavía no puede liberarse: requiere revisión operativa.</p> : null}</div><p className="text-sm text-muted-foreground">{item.room_status === "Available" ? "Esta habitación no requiere una acción de limpieza ahora." : item.room_status === "Maintenance" ? "El caso debe resolverse y volver a Por limpiar; no se puede liberar directo a Lista." : "Seguí la acción principal para mover esta tarea al siguiente estado."}</p></div>
      <div id={`housekeeping-${item.room_id}-panel-action`} role="tabpanel" aria-labelledby={`housekeeping-${item.room_id}-tab-action`} hidden={tab !== "action"} className="space-y-4">{item.isOrphanDeparture ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-900">Habitación no disponible en board. Actualizá para revisar la salida; no se inventa una acción de limpieza.</p> : !canWrite ? <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Perfil de solo lectura: las acciones operativas no están disponibles.</p> : item.isBlocked && item.room_status !== "Maintenance" ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-900">La salida sigue ocupada o bloqueada. Resolvé el bloqueo antes de iniciar una transición.</p> : item.room_status === "Dirty" ? <Button type="button" className="min-h-11 w-full" disabled={loading} onClick={() => onStart(item.room_id)}><Sparkles className="h-4 w-4" />{loading ? "Iniciando…" : "Iniciar limpieza"}</Button> : item.room_status === "Cleaning" ? <Button type="button" className="min-h-11 w-full" disabled={loading} onClick={() => onFinish(item.room_id)}><CheckCircle2 className="h-4 w-4" />{loading ? "Finalizando…" : "Finalizar limpieza"}</Button> : item.room_status === "Maintenance" ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-900">Resolver el caso y volver a Por limpiar.</p> : <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">No hay transición operativa para una habitación Lista.</p>}</div>
      {availableTabs.includes("maintenance") ? <div id={`housekeeping-${item.room_id}-panel-maintenance`} role="tabpanel" aria-labelledby={`housekeeping-${item.room_id}-tab-maintenance`} hidden={tab !== "maintenance"}><MaintenanceCaseActions room={item} loading={loading} onOpen={(payload) => onOpenMaintenance(item.room_id, payload)} onResolve={(payload) => onResolveMaintenance(item.room_id, payload)} /></div> : null}
    </div>
  </div>;
};

export default HousekeepingRoomWorkspace;
