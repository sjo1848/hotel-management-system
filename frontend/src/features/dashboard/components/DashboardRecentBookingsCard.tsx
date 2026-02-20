import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BookingList from "@/features/bookings/components/BookingList";

type DashboardRecentBookingsCardProps = {
  onViewAll: () => void;
};

const DashboardRecentBookingsCard = ({ onViewAll }: DashboardRecentBookingsCardProps) => (
  <Card className="h-full overflow-hidden rounded-3xl border-none shadow-2xl shadow-slate-200/60">
    <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-xl font-black tracking-tight text-slate-900">Últimas Reservas</CardTitle>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-400">Actividad reciente</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-slate-200 bg-white text-xs font-bold uppercase tracking-widest"
          onClick={onViewAll}
        >
          Ver todo
        </Button>
      </div>
    </CardHeader>
    <CardContent className="bg-white p-0 text-slate-900">
      <BookingList />
    </CardContent>
  </Card>
);

export default DashboardRecentBookingsCard;
