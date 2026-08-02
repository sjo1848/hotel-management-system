import { useState } from "react";
import { Clock3, Loader2, UserX, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booking, BookingFrontDeskData, BookingStatus } from "@/types/domain";

type BookingArrivalExceptionActionsProps = {
  booking: Booking;
  statusLoading: BookingStatus | null;
  onAction: (status: BookingStatus, data: Partial<BookingFrontDeskData>) => void;
};

const toLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(`${value.replace("Z", "")}Z`);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toUtcNaive = (value: string) => new Date(value).toISOString().slice(0, 19);

const BookingArrivalExceptionActions = ({
  booking,
  statusLoading,
  onAction,
}: BookingArrivalExceptionActionsProps) => {
  const [terminalReason, setTerminalReason] = useState("");
  const [lateEta, setLateEta] = useState(() =>
    toLocalInput(booking.operational_data?.late_arrival_eta),
  );
  const [lateNote, setLateNote] = useState(
    booking.operational_data?.late_arrival_note ?? "",
  );
  const [pendingTerminalAction, setPendingTerminalAction] = useState<
    "Cancelled" | "NoShow" | null
  >(null);

  const reasonIsValid = terminalReason.trim().length >= 6;
  const lateEtaTimestamp = Date.parse(lateEta);
  const lateEtaDate = Number.isFinite(lateEtaTimestamp)
    ? new Date(lateEtaTimestamp).toISOString().slice(0, 10)
    : "";
  const lateIsValid =
    lateNote.trim().length >= 6 &&
    lateEta.length > 0 &&
    Number.isFinite(lateEtaTimestamp) &&
    lateEtaTimestamp > Date.now() &&
    lateEtaDate >= booking.check_in &&
    lateEtaDate < booking.check_out;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const canMarkNoShow = todayUtc >= booking.check_in;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">
          Excepciones de llegada
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Requieren motivo y quedan registradas en auditoría.
        </p>
      </div>

      {booking.operational_data?.late_arrival_eta ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          Llegada tardía informada: {toLocalInput(booking.operational_data.late_arrival_eta).replace("T", " ")}
          {booking.operational_data.late_arrival_note
            ? ` · ${booking.operational_data.late_arrival_note}`
            : ""}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`late-eta-${booking.id}`}>Nueva ETA</Label>
        <Input
          id={`late-eta-${booking.id}`}
          type="datetime-local"
          value={lateEta}
          onChange={(event) => setLateEta(event.target.value)}
        />
        <Label htmlFor={`late-note-${booking.id}`}>Nota de llegada tardía</Label>
        <Input
          id={`late-note-${booking.id}`}
          value={lateNote}
          maxLength={250}
          placeholder="Ej: vuelo demorado, llega a las 23:30"
          onChange={(event) => setLateNote(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          La ETA debe ser futura y estar dentro de la estadía.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={statusLoading !== null || !lateIsValid}
          onClick={() =>
            onAction("Confirmed", {
              late_arrival_eta: toUtcNaive(lateEta),
              late_arrival_note: lateNote.trim(),
            })
          }
        >
          {statusLoading === "Confirmed" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock3 className="h-4 w-4" />
          )}
          Registrar llegada tardía
        </Button>
      </div>

      <div className="grid gap-2 border-t border-border pt-4">
        <Label htmlFor={`terminal-reason-${booking.id}`}>Motivo terminal</Label>
        <Input
          id={`terminal-reason-${booking.id}`}
          value={terminalReason}
          maxLength={250}
          placeholder="Mínimo 6 caracteres"
          onChange={(event) => setTerminalReason(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="border-destructive/20 text-destructive hover:bg-destructive/10"
            disabled={statusLoading !== null || !reasonIsValid}
            onClick={() => setPendingTerminalAction("Cancelled")}
          >
            {statusLoading === "Cancelled" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Cancelar reserva
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={statusLoading !== null || !reasonIsValid || !canMarkNoShow}
            title={canMarkNoShow ? undefined : "Disponible desde la fecha de llegada"}
            onClick={() => setPendingTerminalAction("NoShow")}
          >
            {statusLoading === "NoShow" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserX className="h-4 w-4" />
            )}
            Marcar no-show
          </Button>
        </div>

        {pendingTerminalAction ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm font-semibold text-foreground">
              {pendingTerminalAction === "Cancelled"
                ? "Vas a cancelar esta reserva"
                : "Vas a registrar un no-show"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              La acción libera la disponibilidad, deja motivo, actor y hora en auditoría y no permite volver al estado anterior desde recepción.
            </p>
            <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground">
              Motivo: {terminalReason.trim()}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingTerminalAction(null)}
              >
                Volver
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={statusLoading !== null || !reasonIsValid}
                onClick={() => {
                  onAction(pendingTerminalAction, {
                    terminal_reason: terminalReason.trim(),
                  });
                  setPendingTerminalAction(null);
                }}
              >
                {pendingTerminalAction === "Cancelled"
                  ? "Confirmar cancelación"
                  : "Confirmar no-show"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BookingArrivalExceptionActions;
