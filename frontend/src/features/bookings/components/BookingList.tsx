import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Booking, getBookings, updateBooking } from '../services/bookingService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import BookingEditDrawer from './BookingEditDrawer';

const BookingList = ({ limit = 5, showActions = false }: { limit?: number; showActions?: boolean }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    getBookings()
      .then((res) => {
        setBookings(res);
        setError('');
      })
      .catch((err) => {
        console.error('Error cargando reservas:', err);
        setError('No se pudieron cargar las reservas.');
        toast({
          title: 'Error al cargar reservas',
          description: 'Reintentá en unos segundos.',
          variant: 'error',
        });
        setBookings([]);
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const handleEdit = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsEditOpen(true);
  };

  const handleUpdated = (updated: Booking) => {
    setBookings((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const handleCancel = async (booking: Booking) => {
    if (booking.status === 'Cancelled' || booking.status === 'CANCELLED') return;
    const confirmCancel = window.confirm(
      '¿Querés cancelar esta reserva? Esta acción no se puede deshacer.',
    );
    if (!confirmCancel) return;
    try {
      const updated = await updateBooking(booking.id, { status: 'CANCELLED' });
      toast({
        title: 'Reserva cancelada',
        description: 'La reserva quedó marcada como cancelada.',
        variant: "success",
      });
      handleUpdated(updated);
    } catch (error) {
      toast({
        title: 'No se pudo cancelar',
        description: String(error),
        variant: 'error',
      });
    }
  };

  if (loading) {
    return <div className='p-12 flex justify-center text-slate-400 bg-white'><Loader2 className='animate-spin w-8 h-8 text-primary' /></div>;
  }

  const visibleBookings = limit ? bookings.slice(0, limit) : bookings;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return <Badge variant='outline' className='bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase text-[10px] tracking-tighter'>Huésped en Casa</Badge>;
      case 'CHECKED_OUT':
        return <Badge variant='outline' className='bg-slate-50 text-slate-600 border-slate-200 font-bold uppercase text-[10px] tracking-tighter'>Finalizada</Badge>;
      case 'CANCELLED':
      case 'Cancelled':
        return <Badge variant='outline' className='bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase text-[10px] tracking-tighter'>Cancelada</Badge>;
      default:
        return <Badge variant='outline' className='bg-indigo-50 text-indigo-700 border-indigo-200 font-bold uppercase text-[10px] tracking-tighter'>Confirmada</Badge>;
    }
  };

  return (
    <>
    <div className='overflow-x-auto'>
    <Table>
      <TableHeader>
        <TableRow className='bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100'>
          <TableHead className='text-[10px] font-black text-slate-400 uppercase tracking-widest pl-8 py-4'>Reserva ID</TableHead>
          <TableHead className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Huésped</TableHead>
          <TableHead className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Estancia</TableHead>
          <TableHead className='text-right text-[10px] font-black text-slate-400 uppercase tracking-widest'>Estado</TableHead>
          {showActions ? (
            <TableHead className='text-right text-[10px] font-black text-slate-400 uppercase tracking-widest pr-8'>Gestión</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {error ? (
          <TableRow>
            <TableCell colSpan={showActions ? 5 : 4} className='h-32 text-center text-slate-500 font-medium'>
              {error}
            </TableCell>
          </TableRow>
        ) : bookings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 5 : 4} className='h-32 text-center text-slate-500 font-medium'>
              No hay movimientos registrados.
            </TableCell>
          </TableRow>
        ) : (
          visibleBookings.map((booking) => (
            <TableRow key={booking.id} className='hover:bg-slate-50/50 border-b border-slate-50 last:border-0 transition-colors'>
              <TableCell className='font-mono text-[10px] font-bold text-slate-400 pl-8'>
                #{String(booking.id).slice(0, 8).toUpperCase()}
              </TableCell>
              <TableCell className='font-black text-slate-700 text-sm py-4'>
                {booking.guest_name}
              </TableCell>
              <TableCell className='text-xs font-bold text-slate-500'>
                <div className='flex items-center gap-2'>
                  <span>{format(new Date(booking.check_in), 'MMM dd', { locale: es })}</span>
                  <span className='w-4 h-px bg-slate-200'></span>
                  <span>{format(new Date(booking.check_out), 'MMM dd', { locale: es })}</span>
                </div>
              </TableCell>
              <TableCell className='text-right'>
                {getStatusBadge(booking.status)}
              </TableCell>
              {showActions ? (
                <TableCell className='text-right pr-8'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant="ghost"
                      size="sm"
                      className='h-8 px-3 font-black text-[10px] uppercase tracking-widest text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200'
                      onClick={() => handleEdit(booking)}
                    >
                      Gestionar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className='h-8 px-3 font-black text-[10px] uppercase tracking-widest text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 disabled:opacity-0'
                      onClick={() => handleCancel(booking)}
                      disabled={booking.status === 'Cancelled' || booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT'}
                    >
                      Cancelar
                    </Button>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
    </div>
    <BookingEditDrawer
      booking={selectedBooking}
      isOpen={isEditOpen}
      onClose={() => setIsEditOpen(false)}
      onUpdated={handleUpdated}
    />
    </>
  );
};

export default BookingList;
