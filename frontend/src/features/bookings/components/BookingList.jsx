import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import client from '@/api/client';
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

const BookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    // Si la API falla, usamos un array vacio para que no explote el frontend
    client.get('/bookings')
      .then((res) => {
        setBookings(res.data);
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

  if (loading) {
    return <div className='p-4 flex justify-center text-slate-400'><Loader2 className='animate-spin' /></div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className='bg-slate-50'>
          <TableHead className='text-slate-600 font-semibold'>ID</TableHead>
          <TableHead className='text-slate-600 font-semibold'>Huésped</TableHead>
          <TableHead className='text-slate-600 font-semibold'>Fechas</TableHead>
          <TableHead className='text-right text-slate-600 font-semibold'>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {error ? (
          <TableRow>
            <TableCell colSpan={4} className='h-24 text-center text-slate-500'>
              {error}
            </TableCell>
          </TableRow>
        ) : bookings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className='h-24 text-center text-slate-500'>
              Sin movimientos recientes.
            </TableCell>
          </TableRow>
        ) : (
          bookings.slice(0, 5).map((booking) => (
            <TableRow key={booking.id} className='hover:bg-slate-50'>
              <TableCell className='font-mono text-xs text-slate-500'>
                {String(booking.id).slice(0, 6)}...
              </TableCell>
              <TableCell className='font-medium'>{booking.guest_name}</TableCell>
              <TableCell className='text-xs text-slate-600'>
                {format(new Date(booking.start_date), 'dd/MM', { locale: es })} - {format(new Date(booking.end_date), 'dd/MM', { locale: es })}
              </TableCell>
              <TableCell className='text-right'>
                <Badge variant='outline' className='bg-emerald-50 text-emerald-700 border-emerald-200'>Confirmada</Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

export default BookingList;
