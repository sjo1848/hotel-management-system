import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarRange,
  ClipboardList,
  DollarSign,
  Loader2,
  PencilLine,
  Settings2,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabStrip } from "@/components/ui/tab-strip";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/api/errors";
import type { Room, RoomHold, RoomHoldType, RoomStatus } from "@/types/domain";
import {
  createRoomHold,
  deleteRoomHold,
  getRoomHolds,
  updateRoomHold,
  updateRoom,
  updateRoomStatus,
} from "@/features/rooms/services/roomService";
import AuditTimeline from "@/features/audit/components/AuditTimeline";
import { roleHasCapability } from "@/features/auth/capabilities";
import { useAuth } from "@/features/auth/useAuth";
import RoomFormFields, { type RoomFormValues } from "./RoomFormFields";
import { getRoomHoldBadge, getRoomHoldMeta, ROOM_HOLD_TYPE_OPTIONS } from "./roomHoldPresentation";
import { getRoomStatusBadge } from "./roomPresentation";

const toFormValues = (room: Room | null): RoomFormValues => ({
  room_number: room?.room_number ?? "",
  room_type: room?.room_type ?? "Standard",
  price: room ? (room.price_cents / 100).toFixed(2) : "",
});

type DetailTab = "resumen" | "operacion" | "configuracion" | "bloqueos" | "historial";

const statusActions: Array<{
  label: string;
  status: "AVAILABLE" | "DIRTY";
  current: RoomStatus;
  icon: LucideIcon;
}> = [
  { label: "Disponible", status: "AVAILABLE", current: "Available", icon: Sparkles },
  { label: "Limpieza", status: "DIRTY", current: "Dirty", icon: ClipboardList },
];

const resetHoldFormValues = () => ({
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  hold_type: "Commercial" as RoomHoldType,
  reason: "",
});

export type RoomDetailWorkspaceProps = {
  room: Room | null;
  variant?: "inline" | "sheet";
  canManageInventory: boolean;
  canManageStatus: boolean;
  canCreateBooking: boolean;
  onReserve: (room: Room) => void;
  onRequestClose: () => void;
  onSaved: () => Promise<void> | void;
};

export const RoomDetailWorkspace = ({
  room,
  variant = "sheet",
  canManageInventory,
  canManageStatus,
  canCreateBooking,
  onReserve,
  onRequestClose,
  onSaved,
}: RoomDetailWorkspaceProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const canViewAudit = roleHasCapability(user?.role, "audit.events.read");

  const [activeTab, setActiveTab] = useState<DetailTab>("resumen");
  const [formValues, setFormValues] = useState<RoomFormValues>(toFormValues(room));
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<RoomStatus | null>(null);
  const [auditRefreshTick, setAuditRefreshTick] = useState(0);
  const [holds, setHolds] = useState<RoomHold[]>([]);
  const [loadingHolds, setLoadingHolds] = useState(false);
  const [holdsError, setHoldsError] = useState<string | null>(null);
  const [savingHold, setSavingHold] = useState(false);
  const [deletingHoldId, setDeletingHoldId] = useState<string | null>(null);
  const [confirmingDeleteHoldId, setConfirmingDeleteHoldId] = useState<string | null>(null);
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null);
  const [holdForm, setHoldForm] = useState(resetHoldFormValues);
  const [leaveWarning, setLeaveWarning] = useState<null | "tab" | "close">(null);

  const tabs = useMemo(() => {
    const items: Array<{ id: DetailTab; label: string }> = [{ id: "resumen", label: "Resumen" }];
    if (canManageStatus) items.push({ id: "operacion", label: "Operación" });
    if (canManageInventory) items.push({ id: "configuracion", label: "Configuración" });
    items.push({ id: "bloqueos", label: "Bloqueos" });
    if (canViewAudit) items.push({ id: "historial", label: "Historial" });
    return items;
  }, [canManageInventory, canManageStatus, canViewAudit]);

  const formDirty = useMemo(
    () => JSON.stringify(formValues) !== JSON.stringify(toFormValues(room)),
    [formValues, room],
  );

  const nextAction = useMemo(() => {
    if (!room) {
      return null;
    }
    if (room.status === "Maintenance") {
      return {
        title: "Resolver mantenimiento antes de volver a vender",
        description:
          "La habitación sigue fuera de venta. Confirma si debe quedar bloqueada por fechas o si ya puede volver a limpieza/disponibilidad.",
      };
    }
    if (room.status === "Dirty" || room.status === "Cleaning") {
      return {
        title: "Coordinar housekeeping para recuperar inventario",
        description:
          "Esta pieza todavía consume operación. Si el trabajo terminó, mueve el estado para devolverla a venta cuanto antes.",
      };
    }
    if (holds.length > 0) {
      return {
        title: "Revisar bloqueos activos antes de abrir disponibilidad",
        description:
          "La habitación parece sana, pero tiene rangos retenidos. Ajusta o libera esos holds si el inventario ya se puede comercializar.",
      };
    }
    return {
      title: "Inventario listo para venta y reasignación",
      description:
        "La pieza está disponible y sin bloqueos activos. Desde acá conviene revisar tarifa base o dejarla lista para reservas inmediatas.",
    };
  }, [holds.length, room]);

  useEffect(() => {
    setFormValues(toFormValues(room));
    setSaving(false);
    setUpdatingStatus(null);
    setHoldForm(resetHoldFormValues());
    setEditingHoldId(null);
    setConfirmingDeleteHoldId(null);
    setHoldsError(null);
    setLeaveWarning(null);
  }, [room]);

  useEffect(() => {
    if (!room) {
      setHolds([]);
      return;
    }
    let cancelled = false;
    setLoadingHolds(true);
    getRoomHolds(room.id)
      .then((nextHolds) => {
        if (!cancelled) setHolds(nextHolds);
      })
      .catch(() => {
        if (!cancelled) setHoldsError("No se pudieron cargar los bloqueos.");
      })
      .finally(() => {
        if (!cancelled) setLoadingHolds(false);
      });
    return () => {
      cancelled = true;
    };
  }, [room?.id]);

  const refreshHolds = async () => {
    if (!room) return;
    setLoadingHolds(true);
    setHoldsError(null);
    try {
      const nextHolds = await getRoomHolds(room.id);
      setHolds(nextHolds);
    } catch (error: unknown) {
      setHoldsError(getErrorMessage(error, "No se pudieron cargar los bloqueos."));
    } finally {
      setLoadingHolds(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) return;

    setSaving(true);
    try {
      await updateRoom(room.id, {
        room_number: formValues.room_number.trim(),
        room_type: formValues.room_type.trim(),
        price_cents: Math.round(Number(formValues.price || "0") * 100),
      });
      toast({
        title: "Habitación actualizada",
        description: `Los datos de la habitación ${formValues.room_number.trim()} fueron guardados.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo guardar",
        description: getErrorMessage(error, "Revisa los datos e intenta nuevamente."),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: "AVAILABLE" | "DIRTY") => {
    if (!room) return;

    setUpdatingStatus(room.status);
    try {
      await updateRoomStatus(room.id, nextStatus);
      toast({
        title: "Estado actualizado",
        description: `La habitación ${room.room_number} ahora está en ${nextStatus.toLowerCase()}.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo cambiar el estado",
        description: getErrorMessage(error, "La transición solicitada no fue aceptada."),
        variant: "error",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCreateHold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) return;

    setSavingHold(true);
    try {
      if (editingHoldId) {
        await updateRoomHold(room.id, editingHoldId, {
          start_date: holdForm.start_date,
          end_date: holdForm.end_date,
          hold_type: holdForm.hold_type,
          reason: holdForm.reason.trim(),
        });
      } else {
        await createRoomHold(room.id, {
          start_date: holdForm.start_date,
          end_date: holdForm.end_date,
          hold_type: holdForm.hold_type,
          reason: holdForm.reason.trim(),
        });
      }
      toast({
        title: editingHoldId ? "Bloqueo actualizado" : "Bloqueo creado",
        description: editingHoldId
          ? `Se actualizaron las fechas y el tipo del bloqueo de la habitación ${room.room_number}.`
          : `La habitación ${room.room_number} quedó bloqueada en el rango indicado.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      setHoldForm(resetHoldFormValues());
      setEditingHoldId(null);
      await refreshHolds();
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo crear el bloqueo",
        description: getErrorMessage(error, "Revisa fechas y motivo."),
        variant: "error",
      });
    } finally {
      setSavingHold(false);
    }
  };

  const handleEditHold = (hold: RoomHold) => {
    setEditingHoldId(hold.id);
    setConfirmingDeleteHoldId(null);
    setHoldForm({
      start_date: hold.start_date,
      end_date: hold.end_date,
      hold_type: hold.hold_type,
      reason: hold.reason,
    });
  };

  const resetHoldForm = () => {
    setEditingHoldId(null);
    setConfirmingDeleteHoldId(null);
    setHoldForm(resetHoldFormValues());
  };

  const handleDeleteHold = async (holdId: string) => {
    if (!room) return;

    setDeletingHoldId(holdId);
    setConfirmingDeleteHoldId(null);
    try {
      await deleteRoomHold(room.id, holdId);
      toast({
        title: "Bloqueo liberado",
        description: `El rango bloqueado de la habitación ${room.room_number} fue liberado.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await refreshHolds();
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo liberar el bloqueo",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    } finally {
      setDeletingHoldId(null);
    }
  };

  const holdDateInvalid =
    !holdForm.end_date || !holdForm.start_date || holdForm.end_date <= holdForm.start_date;
  const holdReasonMissing = holdForm.reason.trim().length === 0;

  const requestTabChange = (next: DetailTab) => {
    if (formDirty && activeTab === "configuracion" && next !== "configuracion") {
      setLeaveWarning("tab");
      return;
    }
    setActiveTab(next);
  };

  const requestClose = () => {
    if (formDirty) {
      setLeaveWarning("close");
      return;
    }
    onRequestClose();
  };

  const discardDirty = () => {
    setFormValues(toFormValues(room));
    setLeaveWarning(null);
    if (leaveWarning === "tab" && activeTab === "configuracion") {
      setActiveTab("resumen");
    } else if (leaveWarning === "close") {
      onRequestClose();
    }
  };

  const primaryStickyAction = () => {
    if (!room) return null;
    switch (activeTab) {
      case "resumen":
        if (room.status === "Available" && canCreateBooking) {
          return (
            <Button className="h-12 flex-1 rounded-xl" onClick={() => onReserve(room)}>
              Reservar
            </Button>
          );
        }
        return null;
      case "operacion": {
        const canGoAvailable = room.status === "Cleaning" || room.status === "Available";
        const action = canGoAvailable ? statusActions[0] : statusActions[1];
        if (room.status === "Maintenance") return null;
        return (
          <Button
            className="h-12 flex-1 rounded-xl"
            disabled={updatingStatus !== null}
            onClick={() => handleStatusChange(action.status)}
          >
            {updatingStatus !== null ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <action.icon className="h-4 w-4" />
            )}
            {action.label}
          </Button>
        );
      }
      case "configuracion":
        return (
          <Button
            form="room-detail-config-form"
            type="submit"
            disabled={saving}
            className="h-12 flex-1 rounded-xl"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Guardar cambios
          </Button>
        );
      case "bloqueos":
        if (!canManageInventory) return null;
        return (
          <Button
            form="room-detail-hold-form"
            type="submit"
            disabled={savingHold || holdDateInvalid || holdReasonMissing}
            className="h-12 flex-1 rounded-xl"
          >
            {savingHold ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarRange className="h-4 w-4" />
            )}
            {editingHoldId ? "Guardar bloqueo" : "Crear bloqueo"}
          </Button>
        );
      default:
        return null;
    }
  };

  if (!room) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-5 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              Habitación {room.room_number}
            </h2>
            {getRoomStatusBadge(room.status)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {room.room_type} · ${(room.price_cents / 100).toLocaleString("es-AR")} por noche
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 rounded-xl"
          aria-label="Cerrar detalle"
          onClick={requestClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3 sm:px-6">
        <TabStrip
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={requestTabChange}
          ariaLabel="Secciones del detalle de habitación"
          idPrefix="room-detail"
        />
      </div>

      {leaveWarning ? (
        <div className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:mx-6">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Hay cambios sin guardar en Configuración.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-8 rounded-lg" onClick={discardDirty}>
              Descartar y continuar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg"
              onClick={() => setLeaveWarning(null)}
            >
              Quedarme
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <div
          role="tabpanel"
          id="room-detail-panel-resumen"
          aria-labelledby="room-detail-tab-resumen"
          hidden={activeTab !== "resumen"}
        >
          <div className="space-y-6">
            {nextAction ? (
              <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                  Siguiente movimiento recomendado
                </p>
                <h3 className="mt-3 text-lg font-black tracking-tight text-foreground">
                  {nextAction.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{nextAction.description}</p>
              </section>
            ) : null}

            <section className="grid gap-4 rounded-2xl border border-border bg-background/70 p-4 sm:grid-cols-3">
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Estado exacto
                </p>
                <p className="mt-2 text-lg font-bold text-foreground">{room.status}</p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Bloqueos activos
                </p>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {loadingHolds ? "..." : holds.length}
                </p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Tarifa base
                </p>
                <p className="mt-2 text-lg font-bold text-foreground">
                  ${(room.price_cents / 100).toLocaleString("es-AR")}
                </p>
              </div>
            </section>

            {room.status === "Available" && canCreateBooking ? (
              <Button className="h-12 w-full rounded-xl sm:w-auto sm:px-10" onClick={() => onReserve(room)}>
                Reservar habitación
              </Button>
            ) : null}
          </div>
        </div>

        {canManageStatus ? (
          <div
            role="tabpanel"
            id="room-detail-panel-operacion"
            aria-labelledby="room-detail-tab-operacion"
            hidden={activeTab !== "operacion"}
          >
            <section className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
                    Acciones operativas
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cambia el estado sin salir de la ficha.
                  </p>
                </div>
              </div>
              {room.status === "Maintenance" ? (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-800">
                  El caso debe resolverse desde Housekeeping; luego la habitación vuelve a Dirty.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {statusActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        variant={room.status === action.current ? "default" : "outline"}
                        className="h-11 justify-start rounded-xl"
                        disabled={updatingStatus !== null}
                        onClick={() => handleStatusChange(action.status)}
                      >
                        {updatingStatus !== null ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {canManageInventory ? (
          <div
            role="tabpanel"
            id="room-detail-panel-configuracion"
            aria-labelledby="room-detail-tab-configuracion"
            hidden={activeTab !== "configuracion"}
          >
            <section className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <PencilLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
                    Datos comerciales
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Edita número, tipo y tarifa base sin duplicar formularios.
                  </p>
                </div>
              </div>
              <form
                id="room-detail-config-form"
                className="space-y-6"
                onSubmit={handleSave}
              >
                <RoomFormFields values={formValues} onChange={setFormValues} />
                <div className="flex items-center justify-between gap-3 border-t pt-6">
                  <p className="text-xs text-muted-foreground">
                    {formDirty ? "Hay cambios sin guardar." : "Sin cambios pendientes."}
                  </p>
                  <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        <div
          role="tabpanel"
          id="room-detail-panel-bloqueos"
          aria-labelledby="room-detail-tab-bloqueos"
          hidden={activeTab !== "bloqueos"}
        >
          <section className="rounded-2xl border border-border bg-background/70 p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
                  Bloqueos por fechas
                </h3>
                <p className="text-sm text-muted-foreground">
                  {canManageInventory
                    ? "Saca la habitación de venta temporalmente sin forzar mantenimiento continuo."
                    : "Lectura de rangos retirados de venta."}
                </p>
                {editingHoldId ? (
                  <p className="text-xs font-semibold text-primary">Editando un bloqueo existente.</p>
                ) : null}
              </div>
            </div>

            {canManageInventory ? (
              <form
                id="room-detail-hold-form"
                className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                onSubmit={handleCreateHold}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="hold-start-date">Desde</Label>
                    <Input
                      id="hold-start-date"
                      type="date"
                      value={holdForm.start_date}
                      onChange={(event) =>
                        setHoldForm((current) => ({ ...current, start_date: event.target.value }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="hold-end-date">Hasta</Label>
                    <Input
                      id="hold-end-date"
                      type="date"
                      value={holdForm.end_date}
                      onChange={(event) =>
                        setHoldForm((current) => ({ ...current, end_date: event.target.value }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-start">
                  <div className="grid gap-2">
                    <Label htmlFor="hold-type">Tipo de bloqueo</Label>
                    <select
                      id="hold-type"
                      value={holdForm.hold_type}
                      onChange={(event) =>
                        setHoldForm((current) => ({
                          ...current,
                          hold_type: event.target.value as RoomHoldType,
                        }))
                      }
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                    >
                      {ROOM_HOLD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {getRoomHoldMeta(holdForm.hold_type).description}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="hold-reason">Motivo</Label>
                    <Input
                      id="hold-reason"
                      value={holdForm.reason}
                      onChange={(event) =>
                        setHoldForm((current) => ({ ...current, reason: event.target.value }))
                      }
                      placeholder="Ej: remodelación, grupo VIP, inspección técnica"
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
                {holdDateInvalid || holdReasonMissing ? (
                  <p className="text-xs font-semibold text-destructive">
                    {holdDateInvalid
                      ? "La salida debe ser posterior a la entrada. "
                      : ""}
                    {holdReasonMissing ? "El motivo es obligatorio." : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={savingHold || holdDateInvalid || holdReasonMissing}
                    className="h-11 rounded-xl"
                  >
                    {savingHold ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarRange className="h-4 w-4" />
                    )}
                    {editingHoldId ? "Guardar bloqueo" : "Crear bloqueo"}
                  </Button>
                  {editingHoldId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={resetHoldForm}
                    >
                      Cancelar edición
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Bloqueos registrados
                </p>
                {loadingHolds ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              {holdsError ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="text-sm font-medium text-destructive">{holdsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => void refreshHolds()}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : null}

              {holds.length === 0 && !loadingHolds && !holdsError ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No hay bloqueos configurados para esta habitación.
                </div>
              ) : null}

              {holds.map((hold) => (
                <div
                  key={hold.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {getRoomHoldBadge(hold.hold_type)}
                      <p className="text-sm font-semibold text-foreground">{hold.reason}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hold.start_date} al {hold.end_date}
                    </p>
                  </div>
                  {canManageInventory ? (
                    <div className="flex flex-wrap gap-2">
                      {confirmingDeleteHoldId === hold.id ? (
                        <>
                          <Button
                            type="button"
                            className="h-9 rounded-xl"
                            disabled={deletingHoldId !== null}
                            onClick={() => void handleDeleteHold(hold.id)}
                          >
                            {deletingHoldId === hold.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Confirmar liberación
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 rounded-xl"
                            disabled={deletingHoldId !== null}
                            onClick={() => setConfirmingDeleteHoldId(null)}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-xl"
                            onClick={() => handleEditHold(hold)}
                          >
                            <PencilLine className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-xl text-destructive hover:bg-destructive/10"
                            disabled={deletingHoldId !== null}
                            onClick={() => setConfirmingDeleteHoldId(hold.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Liberar
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        {canViewAudit ? (
          <div
            role="tabpanel"
            id="room-detail-panel-historial"
            aria-labelledby="room-detail-tab-historial"
            hidden={activeTab !== "historial"}
          >
            {activeTab === "historial" ? (
              <AuditTimeline
                title="Auditoría de habitación"
                description="Cambios de estado y desvíos operativos registrados para esta habitación."
                entityIds={[room.id]}
                refreshSignal={`${room.id}:${room.status}:${auditRefreshTick}`}
                emptyMessage="Todavía no hay trazas visibles para esta habitación."
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {variant === "sheet" ? (
        <div className="sticky bottom-0 border-t bg-card/95 p-3 backdrop-blur lg:hidden">
          <div className="flex gap-2">{primaryStickyAction()}</div>
        </div>
      ) : null}
    </div>
  );
};
