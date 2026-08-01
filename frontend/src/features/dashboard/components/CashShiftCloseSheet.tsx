import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CloseCashRequest } from "@/features/dashboard/services/billingService";

type CashShiftCloseSheetProps = {
  open: boolean;
  expectedCashAmountCents: number;
  paymentCount: number;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: CloseCashRequest) => Promise<boolean>;
};

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

const CashShiftCloseSheet = ({
  open,
  expectedCashAmountCents,
  paymentCount,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: CashShiftCloseSheetProps) => {
  const [countedCash, setCountedCash] = useState("");
  const [handoffTo, setHandoffTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setCountedCash((expectedCashAmountCents / 100).toFixed(2));
      setHandoffTo("");
      setNotes("");
    }
  }, [expectedCashAmountCents, open]);

  const countedCashAmountCents = useMemo(() => {
    const parsed = Number(countedCash.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
  }, [countedCash]);
  const difference =
    countedCashAmountCents === null ? null : countedCashAmountCents - expectedCashAmountCents;
  const isValid =
    countedCashAmountCents !== null && handoffTo.trim().length >= 2 && notes.trim().length >= 6;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || countedCashAmountCents === null) return;
    const completed = await onSubmit({
      expected_cash_amount_cents: expectedCashAmountCents,
      counted_cash_amount_cents: countedCashAmountCents,
      handoff_to: handoffTo.trim(),
      notes: notes.trim(),
    });
    if (completed) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Arqueo y handoff de turno</SheetTitle>
          <SheetDescription>
            Verificá el efectivo físico y dejá una entrega clara para el siguiente turno.
          </SheetDescription>
        </SheetHeader>

        <form className="mt-4 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo esperado</p>
              <p className="mt-2 text-xl font-black text-foreground">{formatCurrency(expectedCashAmountCents)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobros del turno</p>
              <p className="mt-2 text-xl font-black text-foreground">{paymentCount}</p>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-foreground">Efectivo contado (ARS)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={countedCash}
              onChange={(event) => setCountedCash(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
            />
          </label>

          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            Diferencia: <strong>{difference === null ? "—" : formatCurrency(difference)}</strong>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-foreground">Entregar a</span>
            <input
              value={handoffTo}
              maxLength={120}
              onChange={(event) => setHandoffTo(event.target.value)}
              placeholder="Turno noche · Martina"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-foreground">Notas de entrega</span>
            <textarea
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Novedades, comprobantes pendientes o diferencias justificadas"
              className="min-h-28 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/50"
            />
          </label>

          <SheetFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Cerrando turno..." : "Confirmar arqueo y cerrar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CashShiftCloseSheet;
