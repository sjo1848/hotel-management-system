import React, { useState, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Users, BedDouble } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval
} from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBookings, Booking } from "@/features/bookings/services/bookingService";
import { getAllRooms, Room } from "@/features/rooms/services/roomService";
import BookingDetailsSheet from "@/features/bookings/components/BookingDetailsSheet";

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsData, roomsData] = await Promise.all([
          getBookings(),
          getAllRooms()
        ]);
        setBookings(bookingsData);

        const roomMap: Record<string, Room> = {};
        roomsData.forEach(r => roomMap[r.id] = r);
        setRooms(roomMap);
      } catch (e) {
        console.error("Error loading calendar data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayBookings = (day: Date) => {
    return bookings.filter(b => {
      const start = new Date(b.check_in);
      const end = new Date(b.check_out);
      return isWithinInterval(day, { start, end });
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-secondary to-amber-600 rounded-lg shadow-lg shadow-secondary/20">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Calendario de Ocupación
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-11">
            Vista mensual del estado de las habitaciones.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-black uppercase tracking-widest min-w-[140px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[120px]">
          {days.map((day, idx) => {
            const dayBookings = getDayBookings(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div
                key={idx}
                className={cn(
                  "border-r border-b border-slate-100 p-2 relative group transition-colors hover:bg-slate-50/50",
                  !isCurrentMonth && "bg-slate-50/30 opacity-40",
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                <span className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  isToday ? "bg-secondary text-white shadow-lg shadow-secondary/30" : "text-slate-500"
                )}>
                  {format(day, "d")}
                </span>

                <div className="space-y-1 overflow-hidden">
                  {dayBookings.slice(0, 3).map(b => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedBooking(b);
                        setIsSheetOpen(true);
                      }}
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border truncate cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm",
                        b.status === "Confirmed" ? "bg-blue-50 text-blue-700 border-blue-100" :
                          b.status === "CheckedIn" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            b.status === "CheckedOut" ? "bg-slate-100 text-slate-600 border-slate-200" :
                              "bg-red-50 text-red-700 border-red-100"
                      )}
                    >
                      {rooms[b.room_id]?.room_number || '??'} - {b.guest_name.split(' ')[0]}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-[8px] font-black text-slate-400 text-center uppercase tracking-tighter">
                      + {dayBookings.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center justify-center pt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Registradas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Finalizadas</span>
        </div>
      </div>

      <BookingDetailsSheet
        booking={selectedBooking}
        room={selectedBooking ? rooms[selectedBooking.room_id] : null}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  );
};

export default CalendarPage;
