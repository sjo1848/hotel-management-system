import { useState, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllRooms } from "@/features/rooms/services/roomService";
import { getBookings } from "@/features/bookings/services/bookingService";
import { Room, Booking } from "@/types/domain";
import TapeChart from "./TapeChart";
import BookingDetailsSheet from "../bookings/components/BookingDetailsSheet";

const CalendarPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsData, bookingsData] = await Promise.all([
          getAllRooms(),
          getBookings(),
        ]);
        setRooms(roomsData);
        setBookings(bookingsData);
      } catch (error) {
        console.error("Error fetching data for calendar", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-lg shadow-lg">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Calendario Maestro
            </h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
            Vista de ocupación y disponibilidad en formato de cinta.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 dark:border-slate-700">
            <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
          </Button>
          <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 dark:border-slate-700">
            Siguiente <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar Informativa */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/40">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <BedDouble className="w-4 h-4" />
                  <span className="text-sm font-bold">Total Habitaciones</span>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-slate-100">{rooms.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <CalendarDays className="w-4 h-4" />
                  <span className="text-sm font-bold">Reservas Activas</span>
                </div>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-200">{bookings.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/40">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-indigo-500 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">Confirmada</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-emerald-500 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">Check-in</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-rose-200 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase text-rose-700 dark:text-rose-200">Cancelada</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tape Chart Principal */}
        <div className="xl:col-span-3">
          <TapeChart />
        </div>
      </div>

      <BookingDetailsSheet
        booking={selectedBooking}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedBooking(null);
        }}
      />
    </div>
  );
};

export default CalendarPage;
