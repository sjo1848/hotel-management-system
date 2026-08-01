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
import { getBookings } from '../services/bookingService';
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
      case 'NoShow':
        return <Badge variant="warning">No-show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-4">
        <CheckCircle2 className="h-8 w-8 animate-pulse text-primary/40" />
        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Actualizando reservas...</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center">
        <AlertCircle className="mb-2 h-10 w-10 text-muted-foreground/35" />
        <p className="text-sm font-bold text-muted-foreground">No hay actividad reciente</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border bg-muted/50">
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Huésped</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fechas</TableHead>
              <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Monto</TableHead>
              <TableHead className="py-4 px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id} className="border-border hover:bg-muted/50 transition-colors group">
                <TableCell className="py-4 px-6">
                  <div className="font-bold text-foreground">{booking.guest_name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Hab {booking.room_id.slice(0,4)}</div>
                </TableCell>
                <TableCell className="py-4 px-6">
                  {getStatusBadge(booking.status)}
                </TableCell>
                <TableCell className="py-4 px-6">
                  <div className="text-xs font-bold text-muted-foreground">{booking.check_in}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">al {booking.check_out}</div>
                </TableCell>
                <TableCell className="py-4 px-6 text-right">
                  <div className="font-mono font-bold text-foreground">${(booking.total_price_cents / 100).toLocaleString()}</div>
                </TableCell>
                <TableCell className="py-4 px-6 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-card hover:shadow-md">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-border shadow-xl">
                      <DropdownMenuItem 
                        className="text-xs font-bold"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsEditOpen(true);
                        }}
                      >
                        Gestionar
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
