import { useEffect, useRef } from "react";
import { Banknote, CreditCard, Loader2, ReceiptText, Wallet } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CashBalance } from "@/features/dashboard/services/billingService";

type CashShiftSummaryProps = {
  balance: CashBalance | null;
  loading: boolean;
  error: string | null;
  isClosing: boolean;
  cashCloseOpen: boolean;
  canCloseCash: boolean;
  onOpenCashClose: () => void;
  onRetry: () => void;
};

const formatCurrency = (cents: number) =>
  `$${(cents / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

const CashShiftSummary = ({
  balance,
  loading,
  error,
  isClosing,
  cashCloseOpen,
  canCloseCash,
  onOpenCashClose,
  onRetry,
}: CashShiftSummaryProps) => {
  const closeCashButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!cashCloseOpen && closeCashButtonRef.current) {
      closeCashButtonRef.current.focus();
    }
  }, [cashCloseOpen]);

  return (
    <section
      aria-label="Caja del turno"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
          Caja del turno
        </h3>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            No se pudo cargar la caja
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 w-full rounded-xl"
            onClick={onRetry}
          >
            Reintentar caja
          </Button>
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : balance === null ? null : (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-3xl font-black tracking-tight text-foreground">
              {formatCurrency(balance.total_amount_cents)}
            </p>
            <p className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {balance.payment_count} cobros
              {balance.opening_time
                ? ` desde ${format(new Date(balance.opening_time), "dd/MM HH:mm")}`
                : ""}
            </p>
          </div>

          {balance.total_amount_cents === 0 ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Todavía no hay cobros registrados en el turno.
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-muted/50 px-3 py-3">
              <div className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Efectivo
                </p>
              </div>
              <p className="mt-1 text-lg font-black leading-none text-foreground">
                {formatCurrency(balance.cash_amount_cents)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 px-3 py-3">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Tarjeta
                </p>
              </div>
              <p className="mt-1 text-lg font-black leading-none text-foreground">
                {formatCurrency(balance.card_amount_cents)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <ReceiptText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Pendiente por cobrar
              </p>
            </div>
            <p className="text-sm font-black text-foreground">
              {formatCurrency(balance.pending_amount_cents)}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                · {balance.pending_bookings_count} reservas
              </span>
            </p>
          </div>

          {canCloseCash ? (
            <Button
              ref={closeCashButtonRef}
              type="button"
              onClick={onOpenCashClose}
              disabled={isClosing}
              className="mt-4 h-11 w-full rounded-xl"
            >
              {isClosing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Cerrar turno
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default CashShiftSummary;
