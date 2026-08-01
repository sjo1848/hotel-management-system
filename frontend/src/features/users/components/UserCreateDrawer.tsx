import { useState } from "react";
import { Loader2, UserPlus, Shield, Lock, User } from "lucide-react";
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
import { createUser, CreateUserPayload } from "../usersService";
import { TenantUserRole } from "@/types/domain";
import { getErrorMessage } from "@/api/errors";

type UserCreateDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const tenantRoles: Array<{
  value: TenantUserRole;
  label: string;
  description: string;
}> = [
  { value: "receptionist", label: "Recepción", description: "Reservas, huéspedes y cobros" },
  { value: "ops", label: "Operaciones", description: "Coordinación operativa del hotel" },
  { value: "housekeeping", label: "Housekeeping", description: "Limpieza y mantenimiento" },
  { value: "admin", label: "Administrador", description: "Configuración y accesos del hotel" },
];

const UserCreateDrawer = ({
  isOpen,
  onClose,
  onSuccess,
}: UserCreateDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<CreateUserPayload>({
    username: "",
    password: "",
    role: "ops",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      toast({ title: "Error", description: "Todos los campos son obligatorios", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await createUser(formData);
      
      toast({
        title: "Usuario creado",
        description: `${formData.username} fue registrado correctamente.`,
        variant: "success",
      });
      
      onSuccess();
      onClose();
      setFormData({ username: "", password: "", role: "ops" }); // Reset
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, "No se pudo crear el usuario");
      toast({
        title: "Error de Registro",
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
            <UserPlus className="w-6 h-6 text-foreground" />
            Nuevo usuario
          </SheetTitle>
          <SheetDescription>
            Registra un nuevo usuario y asigna su rol en el sistema.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> Nombre de Usuario
              </Label>
              <Input
                id="username"
                placeholder="Ej: jdoe_recepcion"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-muted/50 border-border focus:bg-background transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> Contraseña Temporal
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-muted/50 border-border focus:bg-background transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" /> Rol del Sistema
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {tenantRoles.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    aria-pressed={formData.role === role.value}
                    onClick={() => setFormData({ ...formData, role: role.value })}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      formData.role === role.value
                        ? "border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider">{role.label}</p>
                    <p className="text-[10px] opacity-70">{role.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>

          <SheetFooter className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
            <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar usuario"}
            </Button>
          </SheetFooter>
        </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserCreateDrawer;
