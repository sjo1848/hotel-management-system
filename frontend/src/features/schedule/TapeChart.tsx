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
      if (booking.status === 'CheckedOut') statusColor = 'bg-slate-500 dark:bg-slate-600 text-white border-slate-600 dark:border-slate-500';
      if (booking.status === 'Cancelled') statusColor = 'bg-rose-200 dark:bg-rose-900/35 text-rose-700 dark:text-rose-200 border-rose-300 dark:border-rose-700 line-through';

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

  if (loading) return <div className='p-20 flex justify-center bg-white dark:bg-slate-900 h-full w-full items-center rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm'><Loader2 className='animate-spin w-8 h-8 text-primary' /></div>;

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm'>
        <h2 className='text-xl font-bold text-slate-800 dark:text-slate-200 capitalize'>
          {format(startDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className='flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg'>
          <Button variant='ghost' size='sm' onClick={() => moveDate(-7)} className='hover:bg-white dark:hover:bg-slate-800 shadow-none'><ChevronLeft className='w-4 h-4' /></Button>
          <Button variant='ghost' size='sm' onClick={() => setStartDate(startOfToday())} className='hover:bg-white dark:hover:bg-slate-800 shadow-sm font-semibold'>Hoy</Button>
          <Button variant='ghost' size='sm' onClick={() => moveDate(7)} className='hover:bg-white dark:hover:bg-slate-800 shadow-none'><ChevronRight className='w-4 h-4' /></Button>
        </div>
      </div>

      <Card className='overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/40 bg-white dark:bg-slate-900'>
        <table className='w-full border-collapse min-w-[800px]'>
          <thead>
            <tr>
              <th className='p-4 border-b border-r bg-slate-50 dark:bg-slate-800/70 w-[200px] text-left font-bold text-slate-600 dark:text-slate-300 sticky left-0 z-30 shadow-[2px_0_10px_rgba(0,0,0,0.05)]'>
                Habitación
              </th>
              {dateRange.map((date, i) => (
                <th key={i} className={`p-2 border-b min-w-[65px] text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${isSameDay(date, startOfToday()) ? 'bg-orange-50 dark:bg-orange-950/25' : 'bg-slate-50 dark:bg-slate-800/70'}`}>
                  <div className={`text-[10px] font-black uppercase ${isSameDay(date, startOfToday()) ? 'text-orange-600 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}>{format(date, 'EEE', { locale: es })}</div>
                  <div className={`text-sm font-bold ${isSameDay(date, startOfToday()) ? 'text-orange-700 dark:text-orange-200' : 'text-slate-600 dark:text-slate-300'}`}>{format(date, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='bg-white dark:bg-slate-900'>
            {rooms.map((room) => (
              <tr key={room.id} className='hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors group'>
                <td className='p-4 border-b border-r font-bold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-900 z-20 shadow-[2px_0_10px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors'>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col'>
                      <span>{room.room_number}</span>
                      <span className='text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider'>{room.room_type}</span>
                    </div>
                    <div className="flex gap-1">
                      {room.status === 'Dirty' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-200 animate-pulse" />
                      )}
                      {room.status === 'Maintenance' && (
                        <Wrench className="w-3.5 h-3.5 text-amber-500 dark:text-amber-200" />
                      )}
                    </div>
                  </div>
                </td>

                {dateRange.map((date, i) => {
                  const status = getBookingStatus(room.id, date);
                  return (
                    <td key={i} className={`p-0 border-b border-r border-slate-100 dark:border-slate-800 relative h-16 text-center align-middle ${isSameDay(date, startOfToday()) ? 'bg-orange-50/20 dark:bg-orange-950/20' : ''}`}>
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
