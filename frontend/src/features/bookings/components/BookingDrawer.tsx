import React, { useMemo, useState, useEffect } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";

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
import { createBooking } from "../services/bookingService";
import { getGuests, createGuest, type Guest } from "@/features/guests/services/guestService";
import { useToast } from "@/components/ui/toast";

type Room = {
  id: string;
  room_number: string;
  room_type: string;
  price_cents: number;
};

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasDates || nights <= 0) {
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
            email: formData.guest_email
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
        check_in: dates.from!,
        check_out: dates.to!,
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
          <SheetTitle>Confirmar Reserva</SheetTitle>
          <SheetDescription>
            Estás reservando la <strong>{room.room_number}</strong> ({room.room_type})
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Check-in:</span>
              <span className="font-medium">{dates?.from}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Check-out:</span>
              <span className="font-medium">{dates?.to}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold">
              <span>Total Estimado:</span>
              <span>${total.toLocaleString("es-AR")} ({nights} noches)</span>
            </div>
          </div>

          {/* Búsqueda de Huésped */}
          <div className="grid gap-2 relative">
            <Label htmlFor="search-guest">Buscar Huésped Existente</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="search-guest"
                placeholder="Nombre o Email..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowGuestList(true);
                  if (selectedGuestId) setSelectedGuestId(null); // Reset if typing again
                }}
                onFocus={() => setShowGuestList(true)}
              />
            </div>
            
            {showGuestList && filteredGuests.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white border rounded-md shadow-lg z-50 mt-1 max-h-48 overflow-y-auto">
                {filteredGuests.map(guest => (
                  <button
                    key={guest.id}
                    type="button"
                    className="w-full text-left p-2 hover:bg-slate-50 flex flex-col border-b last:border-0"
                    onClick={() => handleSelectGuest(guest)}
                  >
                    <span className="text-sm font-medium">{guest.full_name}</span>
                    <span className="text-xs text-slate-500">{guest.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 pt-2 border-t border-dashed">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <UserPlus className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Datos del Huésped</span>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
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
                value={formData.guest_email}
                onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                required
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="submit"
              disabled={loading || !hasDates || nights <= 0}
              className="w-full bg-slate-900"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar Reserva"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default BookingDrawer;
