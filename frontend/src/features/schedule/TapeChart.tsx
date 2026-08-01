import { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getAllRooms } from '@/features/rooms/services/roomService';
import { getBookings } from '@/features/bookings/services/bookingService';
import BookingEditDrawer from '@/features/bookings/components/BookingEditDrawer';
import { Room, Booking } from '@/types/domain';

const TapeChart = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfToday());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const daysToShow = 14;
  const dateRange = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, daysToShow - 1),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endRange = addDays(startDate, daysToShow);
      const [roomsData, bookingsData] = await Promise.all([
        getAllRooms(),
        getBookings(
          format(startDate, 'yyyy-MM-dd'),
          format(endRange, 'yyyy-MM-dd')
        )
      ]);
      setRooms(roomsData);
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBookingStatus = (roomId: string, date: Date) => {
    const booking = bookings.find(b => 
      b.room_id === roomId && 
      isWithinInterval(date, { start: parseISO(b.check_in), end: parseISO(b.check_out) })
    );

    if (booking) {
      const isStart = isSameDay(parseISO(booking.check_in), date);
      const isEnd = isSameDay(parseISO(booking.check_out), date);
      
      let statusColor = 'bg-indigo-500 text-white border-indigo-600'; // Default Confirmed
      if (booking.status === 'CheckedIn') statusColor = 'bg-emerald-500 text-white border-emerald-600';
      if (booking.status === 'CheckedOut') statusColor = 'bg-slate-400 text-white border-slate-500';
      if (booking.status === 'Cancelled') statusColor = 'bg-rose-200 text-rose-700 border-rose-300 line-through';
      if (booking.status === 'NoShow') statusColor = 'bg-amber-200 text-amber-800 border-amber-300 line-through';

      return { 
        isBooked: true, 
        guest: booking.guest_name,
        isStart,
        isEnd,
        statusColor,
        booking
      };
    }
    return null;
  };

  const moveDate = (days: number) => {
    setStartDate(prev => addDays(prev, days));
  };

  if (loading) return <div className='flex h-full w-full items-center justify-center rounded-3xl border border-border bg-card/95 p-10 shadow-sm sm:p-20'><Loader2 className='h-8 w-8 animate-spin text-primary' /></div>;

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex flex-col gap-3 rounded-3xl border border-border bg-card/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        <h2 className='text-lg font-bold capitalize text-foreground sm:text-xl'>
          {format(startDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className='flex w-full justify-between gap-2 rounded-2xl border border-border bg-muted/50 p-1 sm:w-auto sm:justify-start'>
          <Button variant='ghost' size='sm' onClick={() => moveDate(-7)} className='shadow-none hover:bg-background/80'><ChevronLeft className='w-4 h-4' /></Button>
          <Button variant='ghost' size='sm' onClick={() => setStartDate(startOfToday())} className='font-semibold shadow-sm hover:bg-background/80'>Hoy</Button>
          <Button variant='ghost' size='sm' onClick={() => moveDate(7)} className='shadow-none hover:bg-background/80'><ChevronRight className='w-4 h-4' /></Button>
        </div>
      </div>

      <Card className='overflow-x-auto rounded-3xl border border-border bg-card/95 shadow-xl'>
        <table className='w-full border-collapse min-w-[800px]'>
          <thead>
            <tr>
              <th className='sticky left-0 z-30 w-[200px] border-b border-r border-border bg-muted/70 p-4 text-left font-bold text-muted-foreground shadow-[2px_0_12px_rgba(0,0,0,0.12)]'>
                Habitación
              </th>
              {dateRange.map((date, i) => (
                <th key={i} className={`min-w-[65px] border-b border-r border-border p-2 text-center last:border-r-0 ${isSameDay(date, startOfToday()) ? 'bg-primary/10' : 'bg-muted/60'}`}>
                  <div className={`text-[10px] font-black uppercase ${isSameDay(date, startOfToday()) ? 'text-primary' : 'text-muted-foreground'}`}>{format(date, 'EEE', { locale: es })}</div>
                  <div className={`text-sm font-bold ${isSameDay(date, startOfToday()) ? 'text-foreground' : 'text-foreground/80'}`}>{format(date, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='bg-card/80'>
            {rooms.map((room) => (
              <tr key={room.id} className='group transition-colors hover:bg-muted/30'>
                <td className='sticky left-0 z-20 border-b border-r border-border bg-card p-4 font-bold text-foreground shadow-[2px_0_12px_rgba(0,0,0,0.12)] transition-colors group-hover:bg-muted/30'>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col'>
                      <span>{room.room_number}</span>
                      <span className='text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>{room.room_type}</span>
                    </div>
                    <div className="flex gap-1">
                      {room.status === 'Dirty' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      )}
                      {room.status === 'Maintenance' && (
                        <Wrench className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                  </div>
                </td>

                {dateRange.map((date, i) => {
                  const status = getBookingStatus(room.id, date);
                  return (
                    <td key={i} className={`relative h-16 border-b border-r border-border p-0 text-center align-middle ${isSameDay(date, startOfToday()) ? 'bg-primary/5' : ''}`}>
                      {status && (
                        <div 
                          className={`
                            h-12 mx-0 text-[10px] flex items-center justify-center font-bold truncate cursor-pointer hover:brightness-110 transition-all shadow-md border-y
                            ${status.isStart ? 'rounded-l-lg ml-1 border-l' : 'rounded-l-none'}
                            ${status.isEnd ? 'rounded-r-lg mr-1 border-r' : 'rounded-r-none'}
                            ${status.statusColor} z-10 relative
                          `}
                          onClick={() => {
                            setSelectedBooking(status.booking);
                            setIsDrawerOpen(true);
                          }}
                        >
                          {(status.isStart || (i === 0 && status.isBooked)) && (
                            <span className='px-2 truncate w-full tracking-tight'>{status.guest}</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <BookingEditDrawer 
        booking={selectedBooking}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={() => {
          fetchData();
          setIsDrawerOpen(false);
        }}
      />
    </div>
  );
};

export default TapeChart;
