import { DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CashBalance } from "@/features/dashboard/services/billingService";

type DashboardCashClosureCardProps = {
  balance: CashBalance | null;
  isClosing: boolean;
  onCloseCash: () => void;
};

const DashboardCashClosureCard = ({ balance, isClosing, onCloseCash }: DashboardCashClosureCardProps) => (
  <Card className="group relative h-full overflow-hidden rounded-3xl border-none bg-slate-900 text-white shadow-2xl shadow-slate-200/60">
    <div className="absolute right-0 top-0 p-8 opacity-10 transition-transform group-hover:scale-110">
      <DollarSign className="h-24 w-24" />
    </div>
    <CardHeader>
      <CardTitle className="text-lg font-black tracking-tight">Cierre de Caja</CardTitle>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Balance del Turno Actual</p>
    </CardHeader>
    <CardContent className="relative z-10 space-y-6">
      <div className="space-y-1">
        <p className="text-4xl font-black text-white">${((balance?.total_amount_cents ?? 0) / 100).toLocaleString()}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Ingresos totales acumulados</p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-white/10 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Efectivo</p>
          <p className="text-lg font-bold text-white">${((balance?.cash_amount_cents ?? 0) / 100).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Tarjeta</p>
          <p className="text-lg font-bold text-white">${((balance?.card_amount_cents ?? 0) / 100).toLocaleString()}</p>
        </div>
      </div>

      <Button
        onClick={onCloseCash}
        disabled={isClosing || (balance?.total_amount_cents ?? 0) === 0}
        className="h-12 w-full rounded-xl bg-white text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-xl hover:bg-slate-100"
      >
        {isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar Turno y Cerrar Caja"}
      </Button>
    </CardContent>
  </Card>
);

export default DashboardCashClosureCard;
