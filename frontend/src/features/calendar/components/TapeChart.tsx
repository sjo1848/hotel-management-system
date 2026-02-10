import React, { useEffect, useState } from 'react';
import { format, addDays, startOfToday, eachDayOfInterval, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import client from '@/api/client';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Room } from '@/features/rooms/services/roomService';
import type { Booking } from '@/features/bookings/services/bookingService';

const TapeChart = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(startOfToday());

  const daysToShow = 14;
  const dateRange = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, daysToShow - 1),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, bookingsRes] = await Promise.all([
          client.get('/rooms'),
          client.get('/bookings')
        ]);
        setRooms(roomsRes.data as Room[]);
        setBookings(bookingsRes.data as Booking[]);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getBookingStatus = (roomId: string, date: Date) => {
    const booking = bookings.find(b => 
      b.room_id === roomId && 
      isWithinInterval(date, { start: parseISO(b.check_in), end: parseISO(b.check_out) })
    );

    if (booking) {
      return { 
        isBooked: true, 
        guest: booking.guest_name,
        isStart: isSameDay(parseISO(booking.check_in), date),
        isEnd: isSameDay(parseISO(booking.check_out), date)
      };
    }
    return null;
  };

  const moveDate = (days: number) => {
    setStartDate(prev => addDays(prev, days));
  };

  if (loading) return <div className='p-20 flex justify-center'><Loader2 className='animate-spin w-8 h-8' /></div>;

  return (
    <div className='flex flex-col h-full space-y-4'>
      <div className='flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm'>
        <h2 className='text-lg font-bold text-slate-800 capitalize'>
          {format(startDate, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className='flex gap-2'>
          <Button variant='outline' size='icon' onClick={() => moveDate(-7)}><ChevronLeft className='w-4 h-4' /></Button>
          <Button variant='outline' onClick={() => setStartDate(startOfToday())}>Hoy</Button>
          <Button variant='outline' size='icon' onClick={() => moveDate(7)}><ChevronRight className='w-4 h-4' /></Button>
        </div>
      </div>

      <Card className='overflow-x-auto border rounded-lg shadow-sm bg-white'>
        <table className='w-full border-collapse min-w-[800px]'>
          <thead>
            <tr>
              <th className='p-4 border-b border-r bg-slate-50 w-[200px] text-left font-medium text-slate-500 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'>
                Habitación
              </th>
              {dateRange.map((date, i) => (
                <th key={i} className='p-2 border-b min-w-[60px] text-center bg-slate-50 border-r border-slate-100 last:border-r-0'>
                  <div className='text-xs font-bold text-slate-700 uppercase'>{format(date, 'EEE', { locale: es })}</div>
                  <div className='text-sm text-slate-500'>{format(date, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className='hover:bg-slate-50/50 transition-colors group'>
                <td className='p-3 border-b border-r font-medium text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 transition-colors'>
                  {room.room_number} <span className='text-xs text-slate-400 font-normal ml-1'>({room.room_type})</span>
                </td>

                {dateRange.map((date, i) => {
                  const status = getBookingStatus(room.id, date);
                  return (
                    <td key={i} className='p-0 border-b border-r border-slate-100 relative h-14 text-center align-middle'>
                      {status && (
                        <div 
                          className={`
                            h-10 mx-[1px] text-[10px] flex items-center justify-center font-medium truncate cursor-pointer hover:brightness-95 transition-all shadow-sm
                            ${status.isStart ? 'rounded-l-md ml-1 border-l' : 'rounded-l-none -ml-[1px]'}
                            ${status.isEnd ? 'rounded-r-md mr-1 border-r' : 'rounded-r-none -mr-[1px]'}
                            bg-indigo-100 text-indigo-700 border-y border-indigo-200 z-0 hover:z-10 relative
                          `}
                          title={status.guest}
                        >
                          {(status.isStart || (i === 0 && status.isBooked)) && (
                            <span className='px-1 truncate w-full'>{status.guest.split(' ')[0]}</span>
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
    </div>
  );
};

export default TapeChart;
