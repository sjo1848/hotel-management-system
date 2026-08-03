import { useState } from "react";
import { Loader2, UserPlus, Mail, Phone, User } from "lucide-react";
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
import { createGuest } from "../services/guestService";
import { getErrorMessage } from "@/api/errors";

type GuestCreateDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const GuestCreateDrawer = ({
  isOpen,
  onClose,
  onSuccess,
}: GuestCreateDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!formData.full_name.trim() || !formData.email.trim()) {
      toast({ title: "Error", description: "Nombre y Email son obligatorios", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await createGuest({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || undefined,
        created_at: new Date().toISOString()
      });
      
      toast({
        title: "Huésped registrado",
        description: `${formData.full_name} ha sido añadido a la base de datos.`,
        variant: "success",
      });
      
      onSuccess();
      onClose();
      setFormData({ full_name: "", email: "", phone: "" }); // Reset
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, "No se pudo registrar el huésped");
      toast({
        title: "Error",
        description: errorMsg,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-hidden border-l border-border bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[440px]">
        <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader className="border-b border-border px-4 py-5 sm:px-6 sm:py-6">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            Nuevo Huésped
          </SheetTitle>
          <SheetDescription>
            Registra los datos de contacto de un nuevo cliente.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> Nombre Completo
              </Label>
              <Input
                id="full_name"
                placeholder="Ej: John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="border-border bg-muted/40 transition-colors focus:bg-background"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border-border bg-muted/40 transition-colors focus:bg-background"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" /> Teléfono (Opcional)
              </Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="border-border bg-muted/40 transition-colors focus:bg-background"
              />
            </div>
          </div>
          </div>

          <SheetFooter className="mt-auto border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
            <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar Huésped"}
            </Button>
          </SheetFooter>
        </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GuestCreateDrawer;
