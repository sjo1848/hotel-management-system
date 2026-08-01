import { useState } from "react";
import { AlertTriangle, Loader2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  HousekeepingBoardRoom,
  MarkMaintenanceInput,
  ResolveMaintenanceInput,
} from "@/types/domain";

type Props = {
  room: HousekeepingBoardRoom;
  loading: boolean;
  onOpen: (payload: MarkMaintenanceInput) => void;
  onResolve: (payload: ResolveMaintenanceInput) => void;
};

const MaintenanceCaseActions = ({ room, loading, onOpen, onResolve }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<MarkMaintenanceInput["priority"]>("MEDIUM");
  const [assignedTo, setAssignedTo] = useState("ops");
  const [resolutionNote, setResolutionNote] = useState("");
  const maintenanceCase = room.maintenance_case;

  if (room.room_status === "Maintenance") {
    return (
      <div className="space-y-3">
        {maintenanceCase ? (
          <div className="rounded-xl border border-border bg-muted/60 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold uppercase tracking-wider text-foreground">
                Caso {maintenanceCase.id.slice(0, 8)}
              </span>
              <span className="font-semibold text-muted-foreground">{maintenanceCase.priority}</span>
            </div>
            <p className="mt-2 text-foreground">{maintenanceCase.reason}</p>
            <p className="mt-1 text-muted-foreground">Responsable: {maintenanceCase.assigned_to}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800">
            Estado legacy sin caso visible. Resolverlo creará evidencia de cierre.
          </div>
        )}
        <Label htmlFor={`maintenance-resolution-${room.room_id}`}>Resolución realizada</Label>
        <Input
          id={`maintenance-resolution-${room.room_id}`}
          value={resolutionNote}
          maxLength={250}
          placeholder="Ej: se reemplazó la válvula y se verificó la pérdida"
          onChange={(event) => setResolutionNote(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full rounded-xl border-border"
          disabled={loading || resolutionNote.trim().length < 6}
          onClick={() => onResolve({ resolution_note: resolutionNote.trim() })}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          Resolver y volver a Dirty
        </Button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-xl border-border"
        disabled={loading}
        onClick={() => setExpanded(true)}
      >
        <Wrench className="h-4 w-4" />
        Abrir incidencia
      </Button>
    );
  }

  const canSubmit = reason.trim().length >= 6 && assignedTo.trim().length >= 2;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/70 p-3">
      <Label htmlFor={`maintenance-reason-${room.room_id}`}>Motivo</Label>
      <Input
        id={`maintenance-reason-${room.room_id}`}
        value={reason}
        maxLength={250}
        placeholder="Ej: pérdida de agua en baño"
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`maintenance-priority-${room.room_id}`}>Prioridad</Label>
          <select
            id={`maintenance-priority-${room.room_id}`}
            value={priority}
            onChange={(event) => setPriority(event.target.value as MarkMaintenanceInput["priority"])}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`maintenance-owner-${room.room_id}`}>Responsable</Label>
          <Input
            id={`maintenance-owner-${room.room_id}`}
            value={assignedTo}
            maxLength={100}
            onChange={(event) => setAssignedTo(event.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setExpanded(false)} disabled={loading}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={loading || !canSubmit}
          onClick={() =>
            onOpen({
              reason: reason.trim(),
              priority,
              assigned_to: assignedTo.trim(),
            })
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          Crear caso y bloquear
        </Button>
      </div>
    </div>
  );
};

export default MaintenanceCaseActions;
