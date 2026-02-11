import React from "react";
import BookingList from "./components/BookingList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const BookingsPage = () => {
  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Gestión de Reservas</h2>
          <p className="text-slate-500 font-medium mt-3">
            Listado histórico y control de ocupación en tiempo real.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-12 px-6 rounded-xl border-slate-200 font-bold text-xs uppercase tracking-widest hover:bg-white shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6 px-8">
          <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Todas las estancias</CardTitle>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Filtros aplicados: Recientes</p>
        </CardHeader>
        <CardContent className="p-0">
          <BookingList limit={0} showActions />
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingsPage;
