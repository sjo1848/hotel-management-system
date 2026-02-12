import { useMemo, useState, useEffect } from "react";
import { Loader2, Search, UserPlus, CheckCircle } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// Componentes de UI (shadcn)
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
import { Badge } from "@/components/ui/badge";
import { createBooking } from "../services/bookingService";
import { getGuests, createGuest } from "@/features/guests/services/guestService";
import { useToast } from "@/components/ui/toast";
import { Room, Guest } from "@/types/domain";

type SearchDates = {
  from: string;
  to: string;
} | null;

type BookingDrawerProps = {
  room: Room | null;
  dates: SearchDates;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const BookingDrawer = ({ room, dates, isOpen, onClose, onSuccess }: BookingDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  
  // Estados para búsqueda de huéspedes
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGuestList, setShowGuestList] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    guest_name: "",
    guest_email: "",
  });

  const hasDates = Boolean(dates?.from && dates?.to);
  
  const nights = useMemo(() => {
    if (!dates?.from || !dates?.to) return 0;
    const start = parseISO(dates.from);
    const end = parseISO(dates.to);
    return Math.max(0, differenceInCalendarDays(end, start));
  }, [dates]);

  const total = nights > 0 ? (room?.price_cents || 0) / 100 * nights : 0;

  // Cargar huéspedes al abrir
  useEffect(() => {
    if (isOpen) {
      getGuests().then(setAllGuests).catch(console.error);
      setStep(1); // Reset to first step on open
    } else {
      setSearchTerm("");
      setSelectedGuestId(null);
      setFormData({ guest_name: "", guest_email: "" });
    }
  }, [isOpen]);

  // Filtrar huéspedes
  const filteredGuests = useMemo(() => {
    if (!searchTerm) return [];
    return allGuests.filter(g => 
      g.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [allGuests, searchTerm]);

  const handleSelectGuest = (guest: Guest) => {
    setSelectedGuestId(guest.id);
    setFormData({
      guest_name: guest.full_name,
      guest_email: guest.email
    });
    setSearchTerm(guest.full_name);
    setShowGuestList(false);
  };

  if (!room) return null;

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < 3) {
      nextStep();
      return;
    }
    
    if (!hasDates || nights <= 0 || !dates) {
      toast({ title: "Fechas inválidas", description: "Seleccioná un rango válido.", variant: "error" });
      return;
    }
    setLoading(true);

    try {
      let guestId = selectedGuestId;

      // Si no hay guest_id, intentamos crear el huésped al vuelo
      if (!guestId && formData.guest_name && formData.guest_email) {
        try {
          const newGuest = await createGuest({
            full_name: formData.guest_name,
            email: formData.guest_email,
            created_at: new Date().toISOString()
          });
          guestId = newGuest.id;
        } catch (err) {
          console.warn("No se pudo crear el huésped, se guardará solo el nombre", err);
        }
      }

      const payload = {
        room_id: room.id,
        guest_id: guestId,
        guest_name: formData.guest_name,
        check_in: dates.from,
        check_out: dates.to,
      };

      await createBooking(payload);

      toast({ title: "Reserva confirmada", description: "La habitación quedó reservada.", variant: "success" });
      onSuccess();
      onClose();
    } catch (error) {
      toast({ title: "No se pudo reservar", description: String(error), variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <div className="flex justify-between items-center mb-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-tighter">Paso {step} de 3</Badge>
          </div>
          <SheetTitle>
            {step === 1 && "Resumen de Estancia"}
            {step === 2 && "Datos del Huésped"}
            {step === 3 && "Confirmar Reserva"}
          </SheetTitle>
          <SheetDescription>
            Habitación <strong>{room.room_number}</strong> ({room.room_type})
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-6">
          {/* PASO 1: RESUMEN */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Check-in:</span>
                  <span className="font-bold text-slate-900">{dates?.from}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Check-out:</span>
                  <span className="font-bold text-slate-900">{dates?.to}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Noches:</span>
                  <span className="font-bold text-slate-900">{nights}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 mt-1 flex justify-between items-end">
                  <span className="text-xs text-slate-400 uppercase font-bold">Total Estimado</span>
                  <span className="text-xl font-black text-indigo-600">${total.toLocaleString("es-AR")}</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 italic">
                * El precio incluye impuestos y cargos base del hotel.
              </div>
            </div>
          )}

          {/* PASO 2: HUÉSPED */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-2 relative">
                <Label htmlFor="search-guest" className="text-xs font-bold uppercase text-slate-500">Buscar Huésped Existente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="search-guest"
                    placeholder="Nombre o Email..."
                    className="pl-10 h-11 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowGuestList(true);
                      if (selectedGuestId) setSelectedGuestId(null);
                    }}
                    onFocus={() => setShowGuestList(true)}
                  />
                </div>
                
                {showGuestList && filteredGuests.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border rounded-xl shadow-xl z-50 mt-2 max-h-48 overflow-y-auto overflow-x-hidden p-1 border-slate-100">
                    {filteredGuests.map(guest => (
                      <button
                        key={guest.id}
                        type="button"
                        className="w-full text-left p-3 hover:bg-indigo-50 rounded-lg transition-colors flex flex-col border-b border-slate-50 last:border-0"
                        onClick={() => handleSelectGuest(guest)}
                      >
                        <span className="text-sm font-bold text-slate-800">{guest.full_name}</span>
                        <span className="text-xs text-slate-500">{guest.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <UserPlus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">O registrar nuevo</span>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    className="h-11 rounded-xl"
                    value={formData.guest_name}
                    onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@ejemplo.com"
                    className="h-11 rounded-xl"
                    value={formData.guest_email}
                    onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: CONFIRMACIÓN */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="rounded-2xl border-2 border-indigo-100 p-5 bg-indigo-50/30">
                  <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Resumen Final
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Huésped:</span>
                      <span className="font-bold">{formData.guest_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium text-slate-700">{formData.guest_email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estancia:</span>
                      <span className="font-medium">{nights} noches</span>
                    </div>
                  </div>
               </div>
               <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex justify-between items-center font-black text-emerald-900">
                    <span>A PAGAR:</span>
                    <span className="text-2xl">${total.toLocaleString("es-AR")}</span>
                  </div>
               </div>
            </div>
          )}

          <SheetFooter className="flex-row gap-3 sm:justify-between pt-4">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={loading}
                className="flex-1 rounded-xl h-12"
              >
                Atrás
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || !hasDates || nights <= 0 || (step === 2 && (!formData.guest_name || !formData.guest_email))}
              className={cn(
                "rounded-xl h-12 shadow-lg transition-all",
                step === 3 ? "bg-emerald-600 hover:bg-emerald-700 flex-[2]" : "bg-slate-900 flex-1"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                step === 3 ? "Confirmar y Reservar" : "Siguiente"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default BookingDrawer;
