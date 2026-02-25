import { useState } from "react";
import { Loader2, DoorOpen, DollarSign, Type } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { createRoom } from "../services/roomService";
import { getErrorMessage } from "@/api/errors";

type RoomCreateDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const RoomCreateDrawer = ({
  isOpen,
  onClose,
  onSuccess,
}: RoomCreateDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    room_number: "",
    room_type: "Standard",
    price_cents: 0,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!formData.room_number.trim()) {
      toast({ title: "Error", description: "El número de habitación es obligatorio", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await createRoom({
        room_number: formData.room_number,
        room_type: formData.room_type,
        price_cents: Math.round(formData.price_cents * 100), // Convertir a centavos
      });
      
      toast({
        title: "Habitación creada",
        description: `La habitación ${formData.room_number} ha sido añadida al catálogo.`,
        variant: "success",
      });
      
      onSuccess();
      onClose();
      setFormData({ room_number: "", room_type: "Standard", price_cents: 0 }); // Reset
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, "No se pudo crear la habitación");
      toast({
        title: "Error al crear",
        description: errorMsg,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[440px] bg-card border-l border-border shadow-2xl">
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-indigo-600" />
            Nueva Habitación
          </SheetTitle>
          <SheetDescription>
            Añade una nueva unidad al catálogo del hotel.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="py-6 space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="room_number" className="flex items-center gap-2">
                <Type className="w-4 h-4 text-muted-foreground" /> Número de Habitación
              </Label>
              <Input
                id="room_number"
                placeholder="Ej: 101, A-202..."
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                className="bg-muted border-border focus:bg-card transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="room_type" className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-muted-foreground" /> Tipo de Habitación
              </Label>
              <Input
                id="room_type"
                placeholder="Ej: Standard, Suite, Deluxe..."
                value={formData.room_type}
                onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                className="bg-muted border-border focus:bg-card transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" /> Precio por Noche
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price_cents || ""}
                  onChange={(e) => setFormData({ ...formData, price_cents: parseFloat(e.target.value) || 0 })}
                  className="bg-muted border-border focus:bg-card transition-colors pl-7"
                  required
                />
              </div>
            </div>
          </div>

          <SheetFooter className="pt-6 border-t mt-auto">
            <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 shadow-lg transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear Habitación"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default RoomCreateDrawer;
