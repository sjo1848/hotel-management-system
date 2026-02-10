import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBookings, updateBooking } from '../services/bookingService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import BookingEditDrawer from './BookingEditDrawer';

const BookingList = ({ limit = 5, showActions = false }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    // Si la API falla, usamos un array vacio para que no explote el frontend
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

  const handleEdit = (booking) => {
    setSelectedBooking(booking);
    setIsEditOpen(true);
  };

  const handleUpdated = (updated) => {
    setBookings((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const handleCancel = async (booking) => {
    try {
      const updated = await updateBooking(booking.id, { status: 'CANCELLED' });
      toast({
        title: 'Reserva cancelada',
        description: 'La reserva quedó marcada como cancelada.',
        variant: 'success',
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
    return <div className='p-4 flex justify-center text-slate-400'><Loader2 className='animate-spin' /></div>;
  }

  const visibleBookings = limit ? bookings.slice(0, limit) : bookings;

  return (
    <>
    <div className='overflow-x-auto'>
    <Table>
      <TableHeader>
        <TableRow className='bg-slate-50'>
          <TableHead className='text-slate-600 font-semibold'>ID</TableHead>
          <TableHead className='text-slate-600 font-semibold'>Huésped</TableHead>
          <TableHead className='text-slate-600 font-semibold'>Fechas</TableHead>
          <TableHead className='text-right text-slate-600 font-semibold'>Estado</TableHead>
          {showActions ? (
            <TableHead className='text-right text-slate-600 font-semibold'>Acciones</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {error ? (
          <TableRow>
            <TableCell colSpan={showActions ? 5 : 4} className='h-24 text-center text-slate-500'>
              {error}
            </TableCell>
          </TableRow>
        ) : bookings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 5 : 4} className='h-24 text-center text-slate-500'>
              Sin movimientos recientes.
            </TableCell>
          </TableRow>
        ) : (
          visibleBookings.map((booking) => (
            <TableRow key={booking.id} className='hover:bg-slate-50'>
              <TableCell className='font-mono text-xs text-slate-500'>
                {String(booking.id).slice(0, 6)}...
              </TableCell>
              <TableCell className='font-medium'>{booking.guest_name}</TableCell>
              <TableCell className='text-xs text-slate-600'>
                {format(new Date(booking.check_in), 'dd/MM', { locale: es })} - {format(new Date(booking.check_out), 'dd/MM', { locale: es })}
              </TableCell>
              <TableCell className='text-right'>
                {booking.status === 'Cancelled' ? (
                  <Badge variant='outline' className='bg-rose-50 text-rose-700 border-rose-200'>Cancelada</Badge>
                ) : (
                  <Badge variant='outline' className='bg-emerald-50 text-emerald-700 border-emerald-200'>Confirmada</Badge>
                )}
              </TableCell>
              {showActions ? (
                <TableCell className='text-right space-x-2'>
                  <button
                    type='button'
                    className='text-sm font-medium text-slate-700 hover:text-slate-900'
                    onClick={() => handleEdit(booking)}
                  >
                    Editar
                  </button>
                  <button
                    type='button'
                    className='text-sm font-medium text-rose-600 hover:text-rose-700'
                    onClick={() => handleCancel(booking)}
                  >
                    Cancelar
                  </button>
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
