import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Booking, updateBooking } from "../services/bookingService";
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
  const { toast } = useToast();

  const [formData, setFormData] = useState(() => ({
    guest_name: booking?.guest_name || "",
    check_in: booking?.check_in || "",
    check_out: booking?.check_out || "",
  }));

  useEffect(() => {
    if (booking) {
      setFormData({
        guest_name: booking.guest_name || "",
        check_in: booking.check_in || "",
        check_out: booking.check_out || "",
      });
    }
  }, [booking]);

  if (!booking) return null;

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
      <SheetContent className="sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Editar Reserva</SheetTitle>
          <SheetDescription>
            Actualizá los datos del huésped o las fechas.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 py-6">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nombre del Huésped</Label>
            <Input
              id="edit-name"
              value={formData.guest_name}
              onChange={(e) =>
                setFormData({ ...formData, guest_name: e.target.value })
              }
              required
            />
          </div>

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
            />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={loading} className="w-full bg-slate-900">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default BookingEditDrawer;
