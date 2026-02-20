import { useEffect, useState } from 'react';
import { MoreVertical, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBookings, updateBooking } from '../services/bookingService';
import { Booking } from '@/types/domain';
import { useToast } from '@/components/ui/toast';
import BookingEditDrawer from './BookingEditDrawer';

const BookingList = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Estado para edición
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await getBookings();
      setBookings(data.slice(0, 10)); // Solo las últimas 10 para el dashboard
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error al cargar reservas',
        description: 'Hubo un problema al conectar con el servidor.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (booking: Booking) => {
    if (booking.status === 'Cancelled') return;

    try {
      await updateBooking(booking.id, { status: 'Cancelled' });
      toast({
        title: 'Reserva cancelada',
        variant: 'success',
      });
      fetchBookings();
    } catch (error) {
      toast({
        title: 'Error',
        description: String(error),
        variant: 'error',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <Badge variant="info">Confirmada</Badge>;
      case 'CheckedIn':
        return <Badge variant="success">Check-in</Badge>;
      case 'CheckedOut':
        return <Badge variant="neutral">Finalizada</Badge>;
      case 'Cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-4">
        <CheckCircle2 className="w-8 h-8 text-slate-200 animate-pulse" />
        <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Actualizando reservas...</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-10 h-10 text-slate-200 mb-2" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No hay actividad reciente</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Huésped</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Estado</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Fechas</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Monto</TableHead>
              <TableHead className="py-4 px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id} className="border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                <TableCell className="py-4 px-6">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{booking.guest_name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tighter">Hab {booking.room_id.slice(0,4)}</div>
                </TableCell>
                <TableCell className="py-4 px-6">
                  {getStatusBadge(booking.status)}
                </TableCell>
                <TableCell className="py-4 px-6">
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{booking.check_in}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">al {booking.check_out}</div>
                </TableCell>
                <TableCell className="py-4 px-6 text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">${(booking.total_price_cents / 100).toLocaleString()}</div>
                </TableCell>
                <TableCell className="py-4 px-6 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-all text-slate-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md">
                        <MoreVertical className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-100 dark:border-slate-800 shadow-xl">
                      <DropdownMenuItem 
                        className="text-xs font-bold"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsEditOpen(true);
                        }}
                      >
                        Gestionar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-xs font-bold text-rose-600"
                        disabled={booking.status === 'Cancelled' || booking.status === 'CheckedOut'}
                        onClick={() => handleCancel(booking)}
                      >
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BookingEditDrawer
        booking={selectedBooking}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={fetchBookings}
      />
    </>
  );
};

export default BookingList;
