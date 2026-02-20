import { useEffect, useState } from "react";
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
import { updateBooking, getBookings } from "../services/bookingService";
import roomService from "@/features/rooms/services/roomService";
import extraChargeService from "../services/extraChargeService";
import { useToast } from "@/components/ui/toast";
import { Booking, Room, BookingStatus, ExtraCharge } from "@/types/domain";
import { Plus, Coffee, Beer, WashingMachine, Utensils, Tag } from "lucide-react";

type BookingEditDrawerProps = {
  booking: Booking | null;
  bookingId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onViewDetails?: () => void;
};

const BookingEditDrawer = ({
  booking: initialBooking,
  bookingId,
  isOpen,
  onClose,
  onSuccess,
  onViewDetails,
}: BookingEditDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(initialBooking);
  const [showSuccess, setShowSuccess] = useState<'CheckedIn' | 'CheckedOut' | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    guest_name: "",
    check_in: "",
    check_out: "",
  });

  useEffect(() => {
    const loadBooking = async () => {
      if (!isOpen) return;
      
      let currentBooking = initialBooking;
      
      if (!currentBooking && bookingId) {
        setLoading(true);
        try {
          // Asumimos que getBookings sin params trae todas, o mejor usamos un getById si existiera
          // Por simplicidad en este HMS, buscaremos en la lista o usaremos el servicio
          const all = await getBookings();
          currentBooking = all.find(b => b.id === bookingId) || null;
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }

      setBooking(currentBooking);

      if (currentBooking) {
        setShowSuccess(null);
        setFormData({
          guest_name: currentBooking.guest_name || "",
          check_in: currentBooking.check_in || "",
          check_out: currentBooking.check_out || "",
        });
        // Fetch room status
        roomService.getRoomById(currentBooking.room_id).then(setRoom).catch(console.error);
        // Fetch extra charges
        extraChargeService.getExtraCharges(currentBooking.id).then(setExtraCharges).catch(console.error);
      }
    };

    loadBooking();
  }, [initialBooking, bookingId, isOpen]);

  const handleAddExtra = async (desc: string, amount: number, cat: string) => {
    if (!booking) return;
    try {
      await extraChargeService.addExtraCharge(booking.id, { 
        description: desc, 
        amount_cents: amount, 
        category: cat 
      });
      toast({ title: "Cargo añadido", variant: "success" });
      const updated = await extraChargeService.getExtraCharges(booking.id);
      setExtraCharges(updated);
      setIsAddingExtra(false);
      onSuccess(); // Refresh list to update total price
    } catch (e) {
      toast({ title: "Error", description: "No se pudo añadir el cargo", variant: "error" });
    }
  };

  if (!booking && !loading && isOpen && bookingId) {
      return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="bg-white dark:bg-slate-900">
                <div className="p-10 text-center">No se encontró la reserva</div>
            </SheetContent>
        </Sheet>
      )
  }

  if (!booking) return null;

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (newStatus === 'CheckedIn' && room?.status === 'Dirty') {
      toast({
        title: "Habitación Sucia",
        description: "No se puede realizar el check-in. La habitación debe estar limpia primero.",
        variant: "error",
      });
      return;
    }

    if (newStatus === 'CheckedIn' && room?.status === 'Maintenance') {
      toast({
        title: "En Mantenimiento",
        description: "No se puede realizar el check-in. La habitación está bloqueada.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await updateBooking(booking.id, { status: newStatus });
      toast({
        title: "Estado actualizado",
        description: `La reserva ahora está ${newStatus.toLowerCase()}.`,
        variant: "success",
      });
      
      if (newStatus === 'CheckedIn' || newStatus === 'CheckedOut') {
        setShowSuccess(newStatus as any);
        onSuccess();
      } else {
        onSuccess();
        onClose();
      }
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
      await updateBooking(booking.id, {
        guest_name: formData.guest_name,
        check_in: formData.check_in,
        check_out: formData.check_out,
      });
      toast({
        title: "Reserva actualizada",
        description: "Los cambios se guardaron correctamente.",
        variant: "success",
      });
      onSuccess();
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
      <SheetContent className="sm:max-w-[440px] bg-white dark:bg-slate-900 border-l shadow-2xl overflow-y-auto">
        {showSuccess ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-6 animate-in zoom-in fade-in duration-500">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${showSuccess === 'CheckedIn' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
              <CheckCircle2 className={`w-12 h-12 ${showSuccess === 'CheckedIn' ? 'text-emerald-600' : 'text-blue-600'}`} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {showSuccess === 'CheckedIn' ? 'Check-in Exitoso' : 'Check-out Exitoso'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                {showSuccess === 'CheckedIn' 
                  ? 'El huésped ha sido registrado correctamente y la habitación está ocupada.' 
                  : 'La estancia ha finalizado. Se ha generado la factura correspondiente.'}
              </p>
            </div>
            
            <div className="flex flex-col w-full gap-3 pt-6">
              {showSuccess === 'CheckedOut' && (
                <Button 
                  className="bg-slate-900 text-white rounded-xl h-12 gap-2"
                  onClick={() => {
                    onClose();
                    onViewDetails?.();
                  }}
                >
                  Ver Factura y Detalles
                </Button>
              )}
              <Button 
                variant="outline" 
                className="rounded-xl h-12"
                onClick={onClose}
              >
                Cerrar Panel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="pb-6 border-b">
              <SheetTitle className="text-2xl font-bold">Gestionar Reserva</SheetTitle>
              <SheetDescription>
                ID: <span className="font-mono text-xs">{booking.id.slice(0,8)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {/* Room Status Warning */}
              {room?.status === 'Dirty' && (
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
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones Rápidas</Label>
                <div className="grid grid-cols-2 gap-3">
                  {booking.status === 'Confirmed' && (
                    <Button 
                      onClick={() => handleStatusChange('CheckedIn')}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Check-in
                    </Button>
                  )}
                  {booking.status === 'CheckedIn' && (
                    <Button 
                      onClick={() => handleStatusChange('CheckedOut')}
                      disabled={loading}
                      className="bg-slate-600 hover:bg-slate-700 text-white"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Check-out
                    </Button>
                  )}
                  {booking.status !== 'Cancelled' && booking.status !== 'CheckedOut' && (
                    <Button 
                      variant="outline"
                      onClick={() => handleStatusChange('Cancelled')}
                      disabled={loading}
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {/* Extra Charges Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cargos Extras / Consumos</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-indigo-600 font-bold text-[10px] uppercase"
                    onClick={() => setIsAddingExtra(!isAddingExtra)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Añadir
                  </Button>
                </div>

                {isAddingExtra && (
                  <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-300">
                    <Button variant="outline" className="h-16 flex-col text-[10px] gap-1" onClick={() => handleAddExtra("Minibar: Agua", 300, "MINIBAR")}>
                      <Beer className="w-4 h-4" /> Agua ($3)
                    </Button>
                    <Button variant="outline" className="h-16 flex-col text-[10px] gap-1" onClick={() => handleAddExtra("Minibar: Refresco", 500, "MINIBAR")}>
                      <Utensils className="w-4 h-4" /> Soda ($5)
                    </Button>
                    <Button variant="outline" className="h-16 flex-col text-[10px] gap-1" onClick={() => handleAddExtra("Desayuno Buffet", 1500, "RESTAURANTE")}>
                      <Coffee className="w-4 h-4" /> Desayuno ($15)
                    </Button>
                    <Button variant="outline" className="h-16 flex-col text-[10px] gap-1" onClick={() => handleAddExtra("Servicio Lavandería", 2500, "LAVANDERIA")}>
                      <WashingMachine className="w-4 h-4" /> Lavado ($25)
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {extraCharges.length === 0 ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center py-2">Sin consumos registrados</p>
                  ) : (
                    extraCharges.map(charge => (
                      <div key={charge.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800/70 rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">{charge.description}</span>
                        </div>
                        <span className="font-mono font-bold">${charge.amount_cents / 100}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 pt-6 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Datos de la Estancia</Label>
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
                      className="bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
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
                        className="bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
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
                        className="bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <SheetFooter className="pt-6">
                  <Button type="submit" disabled={loading} className="w-full bg-slate-900 text-white hover:text-white rounded-xl h-12">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Cambios"}
                  </Button>
                </SheetFooter>
              </form>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BookingEditDrawer;
