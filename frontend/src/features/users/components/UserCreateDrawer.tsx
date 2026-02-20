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
import { UserRole } from "@/types/domain";
import { getErrorMessage } from "@/api/errors";

type UserCreateDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

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
    role: "ops" as UserRole,
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
        description: `El operador ${formData.username} ha sido registrado exitosamente.`,
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
      <SheetContent className="sm:max-w-[440px] bg-white dark:bg-slate-900 border-l shadow-2xl">
        <SheetHeader className="pb-6 border-b">
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-slate-900 dark:text-slate-100" />
            Nuevo Operador
          </SheetTitle>
          <SheetDescription>
            Registra un nuevo usuario y asigna su rol en el sistema.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="py-6 space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Nombre de Usuario
              </Label>
              <Input
                id="username"
                placeholder="Ej: jdoe_recepcion"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Contraseña Temporal
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Rol del Sistema
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'ops' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.role === 'ops' 
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold text-xs uppercase tracking-wider">Operador</p>
                  <p className="text-[10px] opacity-70">Acceso a gestión diaria</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'admin' })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.role === 'admin' 
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <p className="font-bold text-xs uppercase tracking-wider">Admin</p>
                  <p className="text-[10px] opacity-70">Control total del sistema</p>
                </button>
              </div>
            </div>
          </div>

          <SheetFooter className="pt-6 border-t">
            <Button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 shadow-lg transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar Operador"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default UserCreateDrawer;
