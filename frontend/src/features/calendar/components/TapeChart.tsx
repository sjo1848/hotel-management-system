import React, { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import roomService, { type Room } from '@/features/rooms/services/roomService';
import { getBookings, type Booking } from '@/features/bookings/services/bookingService';
import BookingEditDrawer from '@/features/bookings/components/BookingEditDrawer';

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
        roomService.getAllRooms(),
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
      if (booking.status === 'CHECKED_IN') statusColor = 'bg-emerald-500 text-white border-emerald-600';
      if (booking.status === 'CHECKED_OUT') statusColor = 'bg-slate-400 text-white border-slate-500';
      if (booking.status === 'CANCELLED' || booking.status === 'Cancelled') statusColor = 'bg-rose-200 text-rose-700 border-rose-300 line-through';

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

  if (loading) return <div className='p-20 flex justify-center bg-white h-full w-full items-center rounded-xl border shadow-sm'><Loader2 className='animate-spin w-8 h-8 text-primary' /></div>;

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm'>
        <h2 className='text-xl font-bold text-slate-800 capitalize'>
          {format(startDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className='flex gap-2 bg-slate-100 p-1 rounded-lg'>
          <Button variant='ghost' size='sm' onClick={() => moveDate(-7)} className='hover:bg-white shadow-none'><ChevronLeft className='w-4 h-4' /></Button>
          <Button variant='ghost' size='sm' onClick={() => setStartDate(startOfToday())} className='hover:bg-white shadow-sm font-semibold'>Hoy</Button>
          <Button variant='ghost' size='sm' onClick={() => moveDate(7)} className='hover:bg-white shadow-none'><ChevronRight className='w-4 h-4' /></Button>
        </div>
      </div>

      <Card className='overflow-x-auto border-none rounded-xl shadow-xl bg-white'>
        <table className='w-full border-collapse min-w-[800px]'>
          <thead>
            <tr>
              <th className='p-4 border-b border-r bg-slate-50 w-[200px] text-left font-bold text-slate-600 sticky left-0 z-30 shadow-[2px_0_10px_rgba(0,0,0,0.05)]'>
                Habitación
              </th>
              {dateRange.map((date, i) => (
                <th key={i} className={`p-2 border-b min-w-[65px] text-center border-r border-slate-100 last:border-r-0 ${isSameDay(date, startOfToday()) ? 'bg-orange-50' : 'bg-slate-50'}`}>
                  <div className={`text-[10px] font-black uppercase ${isSameDay(date, startOfToday()) ? 'text-orange-600' : 'text-slate-400'}`}>{format(date, 'EEE', { locale: es })}</div>
                  <div className={`text-sm font-bold ${isSameDay(date, startOfToday()) ? 'text-orange-700' : 'text-slate-600'}`}>{format(date, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='bg-white'>
            {rooms.map((room) => (
              <tr key={room.id} className='hover:bg-slate-50 transition-colors group'>
                <td className='p-4 border-b border-r font-bold text-slate-700 sticky left-0 bg-white z-20 shadow-[2px_0_10px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors'>
                  <div className='flex flex-col'>
                    <span>{room.room_number}</span>
                    <span className='text-[10px] text-slate-400 font-medium uppercase tracking-wider'>{room.room_type}</span>
                  </div>
                </td>

                {dateRange.map((date, i) => {
                  const status = getBookingStatus(room.id, date);
                  return (
                    <td key={i} className={`p-0 border-b border-r border-slate-100 relative h-16 text-center align-middle ${isSameDay(date, startOfToday()) ? 'bg-orange-50/20' : ''}`}>
                      {status && (
                        <div 
                          className={`
                            h-12 mx-0 text-[10px] flex items-center justify-center font-bold truncate cursor-pointer hover:brightness-110 transition-all shadow-md border-y
                            ${status.isStart ? 'rounded-l-lg ml-1 border-l' : 'rounded-l-none'}
                            ${status.isEnd ? 'rounded-r-lg mr-1 border-r' : 'rounded-r-none'}
                            ${status.statusColor} z-10 relative
                          `}
                          title={`${status.guest} (${status.booking.status})`}
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
        onUpdated={() => {
          fetchData();
          setIsDrawerOpen(false);
        }}
      />
    </div>
  );
};

export default TapeChart;
