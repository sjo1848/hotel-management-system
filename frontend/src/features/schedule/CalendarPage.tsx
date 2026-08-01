import { useState, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllRooms } from "@/features/rooms/services/roomService";
import { getBookings } from "@/features/bookings/services/bookingService";
import { Room, Booking } from "@/types/domain";
import TapeChart from "./TapeChart";
import BookingDetailsSheet from "../bookings/components/BookingDetailsSheet";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title="Calendario Maestro"
        description="Vista de ocupación y disponibilidad en formato de cinta."
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" size="sm" className="h-10 flex-1 sm:flex-none">
              <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
            </Button>
            <Button variant="outline" size="sm" className="h-10 flex-1 sm:flex-none">
              Siguiente <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 sm:gap-6">
        {/* Sidebar Informativa */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="overflow-hidden rounded-3xl border border-border bg-card/95 shadow-xl">
            <CardHeader className="border-b border-border bg-muted/40 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BedDouble className="w-4 h-4" />
                  <span className="text-sm font-bold">Total Habitaciones</span>
                </div>
                <span className="text-lg font-black text-foreground">{rooms.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="w-4 h-4" />
                  <span className="text-sm font-bold">Reservas Activas</span>
                </div>
                <span className="text-lg font-black text-primary">{bookings.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border border-border bg-card/95 shadow-xl">
            <CardHeader className="border-b border-border bg-muted/40 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Leyenda</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-indigo-500 shadow-sm" />
                <span className="text-xs font-bold text-muted-foreground uppercase">Confirmada</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-emerald-500 shadow-sm" />
                <span className="text-xs font-bold text-muted-foreground uppercase">Check-in</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-rose-200 shadow-sm" />
                <span className="text-xs font-bold uppercase text-rose-700 dark:text-rose-300">Cancelada</span>
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
