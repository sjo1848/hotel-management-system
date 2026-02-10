import React, { useState } from "react";
import { Loader2 } from "lucide-react";

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

const BookingDrawer = ({ room, dates, isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    guest_name: "",
    guest_email: "", // Agregaremos email al backend luego, por ahora lo pedimos en UI
  });
  const hasDates = Boolean(dates?.from && dates?.to);

  // Si no hay habitación seleccionada, no renderizamos nada útil
  if (!room) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasDates) return;
    setLoading(true);

    try {
      // Preparamos el payload exacto que espera Rust
      const payload = {
        room_id: room.id,
        guest_name: formData.guest_name,
        start_date: dates.from, // Vienen del buscador
        end_date: dates.to,
      };

      await createBooking(payload);

      // Si todo sale bien:
      onSuccess(); // Avisamos al padre para refrescar
      onClose(); // Cerramos el drawer
      setFormData({ guest_name: "", guest_email: "" }); // Limpiamos
    } catch (error) {
      alert("Error: " + error); // Luego lo haremos bonito con Toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>Confirmar Reserva</SheetTitle>
          <SheetDescription>
            Estás reservando la <strong>{room.room_number}</strong> (
            {room.room_type})
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-6">
          {/* Resumen de Fechas */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Check-in:</span>
              <span className="font-medium">
                {hasDates ? dates.from : "Selecciona fechas"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Check-out:</span>
              <span className="font-medium">
                {hasDates ? dates.to : "Selecciona fechas"}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold">
              <span>Total Estimado:</span>
              {/* Cálculo simple de precio (luego lo haremos exacto) */}
              <span>
                ${(room.price_cents / 100).toLocaleString("es-AR")} / noche
              </span>
            </div>
          </div>

          {/* Campos del Formulario */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del Huésped</Label>
            <Input
              id="name"
              placeholder="Ej: Juan Pérez"
              value={formData.guest_name}
              onChange={(e) =>
                setFormData({ ...formData, guest_name: e.target.value })
              }
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email de Contacto</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@ejemplo.com"
              value={formData.guest_email}
              onChange={(e) =>
                setFormData({ ...formData, guest_email: e.target.value })
              }
              required
            />
          </div>

          <SheetFooter>
            <Button
              type="submit"
              disabled={loading || !hasDates}
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
