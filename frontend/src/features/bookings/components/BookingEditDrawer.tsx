import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, LogOut, XCircle, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Booking, updateBooking, BookingStatus } from "../services/bookingService";
import roomService, { type Room } from "@/features/rooms/services/roomService";
import { useToast } from "@/components/ui/toast";

type BookingEditDrawerProps = {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (booking: Booking) => void;
};

const BookingEditDrawer = ({
  booking,
  isOpen,
  onClose,
  onUpdated,
}: BookingEditDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    guest_name: "",
    check_in: "",
    check_out: "",
  });

  useEffect(() => {
    if (booking && isOpen) {
      setFormData({
        guest_name: booking.guest_name || "",
        check_in: booking.check_in || "",
        check_out: booking.check_out || "",
      });
      // Fetch room status
      roomService.getRoomById(booking.room_id).then(setRoom).catch(console.error);
    }
  }, [booking, isOpen]);

  if (!booking) return null;

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (newStatus === 'CHECKED_IN' && room?.status === 'DIRTY') {
      toast({
        title: "Habitación Sucia",
        description: "No se puede realizar el check-in. La habitación debe estar limpia primero.",
        variant: "error",
      });
      return;
    }

    if (newStatus === 'CHECKED_IN' && room?.status === 'MAINTENANCE') {
      toast({
        title: "En Mantenimiento",
        description: "No se puede realizar el check-in. La habitación está bloqueada.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateBooking(booking.id, { status: newStatus });
      toast({
        title: "Estado actualizado",
        description: `La reserva ahora está ${newStatus.replace('_', ' ').toLowerCase()}.`,
        variant: "success",
      });
      onUpdated(updated);
      onClose();
    } catch (error) {
      toast({ title: "Error", description: String(error), variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const updated = await updateBooking(booking.id, {
        guest_name: formData.guest_name,
        check_in: formData.check_in,
        check_out: formData.check_out,
      });
      toast({
        title: "Reserva actualizada",
        description: "Los cambios se guardaron correctamente.",
        variant: "success",
      });
      onUpdated(updated);
      onClose();
    } catch (error) {
      toast({
        title: "No se pudo actualizar",
        description: String(error),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[440px] bg-white border-l shadow-2xl overflow-y-auto">
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="text-2xl font-bold">Gestionar Reserva</SheetTitle>
          <SheetDescription>
            ID: <span className="font-mono text-xs">{booking.id.slice(0,8)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Room Status Warning */}
          {room?.status === 'DIRTY' && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-rose-900 leading-tight">Habitación Sucia</p>
                <p className="text-xs font-medium text-rose-700 mt-1">Debe marcarse como limpia en Housekeeping antes del check-in.</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Acciones Rápidas</Label>
            <div className="grid grid-cols-2 gap-3">
              {booking.status === 'CONFIRMED' && (
                <Button 
                  onClick={() => handleStatusChange('CHECKED_IN')}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Check-in
                </Button>
              )}
              {booking.status === 'CHECKED_IN' && (
                <Button 
                  onClick={() => handleStatusChange('CHECKED_OUT')}
                  disabled={loading}
                  className="bg-slate-600 hover:bg-slate-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Check-out
                </Button>
              )}
              {booking.status !== 'CANCELLED' && booking.status !== 'CheckedOut' && (
                <Button 
                  variant="outline"
                  onClick={() => handleStatusChange('CANCELLED')}
                  disabled={loading}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pt-6 border-t">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Datos de la Estancia</Label>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre del Huésped</Label>
                <Input
                  id="edit-name"
                  value={formData.guest_name}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_name: e.target.value })
                  }
                  required
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-check-in">Check-in</Label>
                  <Input
                    id="edit-check-in"
                    type="date"
                    value={formData.check_in}
                    onChange={(e) =>
                      setFormData({ ...formData, check_in: e.target.value })
                    }
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-check-out">Check-out</Label>
                  <Input
                    id="edit-check-out"
                    type="date"
                    value={formData.check_out}
                    onChange={(e) =>
                      setFormData({ ...formData, check_out: e.target.value })
                    }
                    required
                    className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="pt-6">
              <Button type="submit" disabled={loading} className="w-full bg-slate-900 h-12 text-lg">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BookingEditDrawer;
