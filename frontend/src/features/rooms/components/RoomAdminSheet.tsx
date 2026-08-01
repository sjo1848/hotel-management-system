import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ClipboardList,
  DollarSign,
  Loader2,
  PencilLine,
  Settings2,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type RoomAdminSheetProps = {
  room: Room | null;
  open: boolean;
  canManageInventory?: boolean;
  canManageStatus?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
};

const statusActions: Array<{
  label: string;
  status: "AVAILABLE" | "DIRTY";
  current: RoomStatus;
  icon: LucideIcon;
}> = [
  { label: "Disponible", status: "AVAILABLE", current: "Available", icon: Sparkles },
  { label: "Limpieza", status: "DIRTY", current: "Dirty", icon: ClipboardList },
];

const RoomAdminSheet = ({
  room,
  open,
  canManageInventory = false,
  canManageStatus = false,
  onOpenChange,
  onSaved,
}: RoomAdminSheetProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formValues, setFormValues] = useState<RoomFormValues>(toFormValues(room));
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<RoomStatus | null>(null);
  const [auditRefreshTick, setAuditRefreshTick] = useState(0);
  const [holds, setHolds] = useState<RoomHold[]>([]);
  const [loadingHolds, setLoadingHolds] = useState(false);
  const [savingHold, setSavingHold] = useState(false);
  const [deletingHoldId, setDeletingHoldId] = useState<string | null>(null);
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null);
  const [holdForm, setHoldForm] = useState({
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    hold_type: "Commercial" as RoomHoldType,
    reason: "",
  });
  const canViewAudit = roleHasCapability(user?.role, "audit.events.read");
  const nextAction = useMemo(() => {
    if (!room) {
      return null;
    }

    if (room.status === "Maintenance") {
      return {
        title: "Resolver mantenimiento antes de volver a vender",
        description:
          "La habitacion sigue fuera de venta. Confirma si debe quedar bloqueada por fechas o si ya puede volver a limpieza/disponibilidad.",
      };
    }

    if (room.status === "Dirty" || room.status === "Cleaning") {
      return {
        title: "Coordinar housekeeping para recuperar inventario",
        description:
          "Esta pieza todavia consume operacion. Si el trabajo termino, mueve el estado para devolverla a venta cuanto antes.",
      };
    }

    if (holds.length > 0) {
      return {
        title: "Revisar bloqueos activos antes de abrir disponibilidad",
        description:
          "La habitacion parece sana, pero tiene rangos retenidos. Ajusta o libera esos holds si el inventario ya se puede comercializar.",
      };
    }

    return {
      title: "Inventario listo para venta y reasignacion",
      description:
        "La pieza esta disponible y sin bloqueos activos. Desde aca conviene revisar tarifa base o dejarla lista para reservas inmediatas.",
    };
  }, [holds.length, room]);

  useEffect(() => {
    setFormValues(toFormValues(room));
    setSaving(false);
    setUpdatingStatus(null);
    setHoldForm({
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      hold_type: "Commercial" as RoomHoldType,
      reason: "",
    });
    setEditingHoldId(null);
  }, [room, open]);

  useEffect(() => {
    if (!open || !room || !canManageInventory) {
      setHolds([]);
      return;
    }

    setLoadingHolds(true);
    getRoomHolds(room.id)
      .then(setHolds)
      .catch(() => setHolds([]))
      .finally(() => setLoadingHolds(false));
  }, [canManageInventory, open, room?.id]);

  const refreshHolds = async () => {
    if (!room) return;
    setLoadingHolds(true);
    try {
      const nextHolds = await getRoomHolds(room.id);
      setHolds(nextHolds);
    } finally {
      setLoadingHolds(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
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
        title: "Habitacion actualizada",
        description: `Los datos de la habitacion ${formValues.room_number.trim()} fueron guardados.`,
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
        description: `La habitacion ${room.room_number} ahora esta en ${nextStatus.toLowerCase()}.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo cambiar el estado",
        description: getErrorMessage(error, "La transicion solicitada no fue aceptada."),
        variant: "error",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCreateHold = async (event: React.FormEvent<HTMLFormElement>) => {
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
          ? `Se actualizaron las fechas y el tipo del bloqueo de la habitacion ${room.room_number}.`
          : `La habitacion ${room.room_number} quedo bloqueada en el rango indicado.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      setHoldForm({
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
        hold_type: "Commercial" as RoomHoldType,
        reason: "",
      });
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
    setHoldForm({
      start_date: hold.start_date,
      end_date: hold.end_date,
      hold_type: hold.hold_type,
      reason: hold.reason,
    });
  };

  const resetHoldForm = () => {
    setEditingHoldId(null);
    setHoldForm({
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      hold_type: "Commercial" as RoomHoldType,
      reason: "",
    });
  };

  const handleDeleteHold = async (holdId: string) => {
    if (!room) return;

    setDeletingHoldId(holdId);
    try {
      await deleteRoomHold(room.id, holdId);
      toast({
        title: "Bloqueo eliminado",
        description: `El rango bloqueado de la habitacion ${room.room_number} fue liberado.`,
        variant: "success",
      });
      setAuditRefreshTick((current) => current + 1);
      await refreshHolds();
      await onSaved();
    } catch (error: unknown) {
      toast({
        title: "No se pudo eliminar el bloqueo",
        description: getErrorMessage(error, "Reintenta en unos segundos."),
        variant: "error",
      });
    } finally {
      setDeletingHoldId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 sm:max-w-[640px]">
        {room ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <div>
                    <SheetTitle className="text-2xl font-black tracking-tight">
                      Habitacion {room.room_number}
                    </SheetTitle>
                    <SheetDescription className="mt-2 max-w-[42ch] text-sm">
                      Consola admin para editar inventario, ajustar tarifa base y mover la habitacion entre estados operativos.
                    </SheetDescription>
                  </div>
                </div>
                {getRoomStatusBadge(room.status)}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6">
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
                    Tipo
                  </p>
                  <p className="mt-2 text-lg font-bold text-foreground">{room.room_type}</p>
                </div>
                <div className="rounded-xl bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Tarifa base
                  </p>
                  <p className="mt-2 text-lg font-bold text-foreground">
                    ${(room.price_cents / 100).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-xl bg-card p-4 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Inventario
                  </p>
                  <p className="mt-2 text-lg font-bold text-foreground">Activa en catalogo</p>
                </div>
              </section>

              {canManageStatus ? (
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
              ) : null}

              {canManageInventory ? (
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
                        Edita numero, tipo y tarifa base sin duplicar formularios.
                      </p>
                    </div>
                  </div>
                  <form className="space-y-6" onSubmit={handleSave}>
                    <RoomFormFields values={formValues} onChange={setFormValues} />
                    <SheetFooter className="mt-6 border-t pt-6">
                      <Button type="submit" disabled={saving} className="h-11 rounded-xl px-6">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                        Guardar cambios
                      </Button>
                    </SheetFooter>
                  </form>
                </section>
              ) : null}

              {canManageInventory ? (
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
                        Saca la habitacion de venta temporalmente sin forzar mantenimiento continuo.
                      </p>
                      {editingHoldId ? (
                        <p className="text-xs font-semibold text-primary">
                          Editando un bloqueo existente.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <form className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm" onSubmit={handleCreateHold}>
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
                          placeholder="Ej: remodelacion, grupo VIP, inspeccion tecnica"
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={savingHold} className="h-11 rounded-xl">
                      {savingHold ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                      {editingHoldId ? "Guardar bloqueo" : "Crear bloqueo"}
                    </Button>
                    {editingHoldId ? (
                      <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={resetHoldForm}>
                        Cancelar edicion
                      </Button>
                    ) : null}
                  </form>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Bloqueos registrados
                      </p>
                      {loadingHolds ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>

                    {holds.length === 0 && !loadingHolds ? (
                      <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                        No hay bloqueos configurados para esta habitacion.
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
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => handleEditHold(hold)}
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl text-destructive hover:bg-destructive/10"
                          disabled={deletingHoldId !== null}
                          onClick={() => handleDeleteHold(hold.id)}
                        >
                          {deletingHoldId === hold.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Liberar
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {canViewAudit ? (
                <AuditTimeline
                  title="Auditoria de habitacion"
                  description="Cambios de estado y desvíos operativos registrados para esta habitacion."
                  entityIds={[room.id]}
                  refreshSignal={`${room.id}:${room.status}:${auditRefreshTick}`}
                  emptyMessage="Todavia no hay trazas visibles para esta habitacion."
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default RoomAdminSheet;
