import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
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
import { Booking, Room, ExtraCharge } from "@/types/domain";
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
            <SheetContent className="w-full border-l border-border bg-card shadow-2xl sm:max-w-[440px]">
                <div className="p-10 text-center">No se encontró la reserva</div>
            </SheetContent>
        </Sheet>
      )
  }

  if (!booking) return null;

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
      <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 shadow-2xl sm:max-w-[440px]">
        {showSuccess ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center space-y-6 px-4 py-10 text-center animate-in zoom-in fade-in duration-500 sm:px-6 sm:py-12">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full shadow-xl ${showSuccess === 'CheckedIn' ? 'bg-primary/12 text-primary' : 'bg-secondary/18 text-secondary-foreground'}`}>
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">
                {showSuccess === 'CheckedIn' ? 'Check-in Exitoso' : 'Check-out Exitoso'}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                {showSuccess === 'CheckedIn' 
                  ? 'El huésped ha sido registrado correctamente y la habitación está ocupada.' 
                  : 'La estancia ha finalizado. Se ha generado la factura correspondiente.'}
              </p>
            </div>
            
            <div className="flex flex-col w-full gap-3 pt-6">
              {showSuccess === 'CheckedOut' && (
                <Button 
                  className="h-12 gap-2 rounded-xl bg-primary text-primary-foreground"
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
                className="h-12 rounded-xl"
                onClick={onClose}
              >
                Cerrar Panel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b px-4 py-5 sm:px-6 sm:py-6">
              <SheetTitle className="text-2xl font-bold">Gestionar Reserva</SheetTitle>
              <SheetDescription>
                ID: <span className="font-mono text-xs">{booking.id.slice(0,8)}</span>
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              {/* Room Status Warning */}
              {room?.status === 'Dirty' && (
                <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-black leading-tight text-destructive">Habitación Sucia</p>
                    <p className="mt-1 text-xs font-medium text-destructive">Debe marcarse como limpia en Housekeeping antes del check-in.</p>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones Rápidas</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(booking.status === 'Confirmed' || booking.status === 'CheckedIn') && (
                    <p className="text-xs text-muted-foreground">
                      El check-in y checkout se completan desde el centro operativo para validar sus checklists.
                    </p>
                  )}
                  {booking.status === 'Confirmed' ? (
                    <p className="text-xs text-muted-foreground">
                      Cancelacion, no-show y llegada tardia se registran con motivo desde el centro operativo.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Extra Charges Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cargos Extras / Consumos</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-bold uppercase text-primary"
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
                    <p className="text-[10px] text-muted-foreground italic text-center py-2">Sin consumos registrados</p>
                  ) : (
                    extraCharges.map(charge => (
                      <div key={charge.id} className="flex justify-between items-center p-2 bg-muted rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">{charge.description}</span>
                        </div>
                        <span className="font-mono font-bold">${charge.amount_cents / 100}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 pt-6 border-t">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos de la Estancia</Label>
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
                      className="bg-muted border-border focus:bg-card transition-colors"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                        className="bg-muted border-border focus:bg-card transition-colors"
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
                        className="bg-muted border-border focus:bg-card transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <SheetFooter className="border-t pt-6">
                  <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-primary">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Cambios"}
                  </Button>
                </SheetFooter>
              </form>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BookingEditDrawer;
