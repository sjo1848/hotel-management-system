import { useState } from "react";
import { Loader2, DoorOpen } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createRoom } from "../services/roomService";
import { getErrorMessage } from "@/api/errors";
import RoomFormFields, { type RoomFormValues } from "./RoomFormFields";

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

  const [formData, setFormData] = useState<RoomFormValues>({
    room_number: "",
    room_type: "Standard",
    price: "",
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
        price_cents: Math.round(Number(formData.price || "0") * 100),
      });
      
      toast({
        title: "Habitación creada",
        description: `La habitación ${formData.room_number} ha sido añadida al catálogo.`,
        variant: "success",
      });
      
      onSuccess();
      onClose();
      setFormData({ room_number: "", room_type: "Standard", price: "" });
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
      <SheetContent className="w-full overflow-hidden border-l border-border bg-card p-0 shadow-2xl sm:max-w-[440px]">
        <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader className="border-b px-4 py-5 sm:px-6 sm:py-6">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="h-6 w-6 text-primary" />
            Nueva Habitación
          </SheetTitle>
          <SheetDescription>
            Añade una nueva unidad al catálogo del hotel.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <RoomFormFields values={formData} onChange={setFormData} />
          </div>

          <SheetFooter className="mt-auto border-t bg-card/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
            <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground shadow-lg transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear Habitación"}
            </Button>
          </SheetFooter>
        </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RoomCreateDrawer;
