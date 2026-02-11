import React, { useEffect, useState } from "react";
import { Plus, Loader2, Shield, User as UserIcon, MoreHorizontal, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { User, createUser, getUsers } from "./usersService";
import { useToast } from "@/components/ui/toast";

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "ops",
  });

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() =>
        toast({
          title: "No se pudieron cargar usuarios",
          description: "Reintentá en unos segundos.",
          variant: "error",
        }),
      )
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createUser(formData);
      setUsers((current) => [created, ...current]);
      toast({
        title: "Usuario creado",
        description: "Se agregó correctamente.",
        variant: "success",
      });
      setDrawerOpen(false);
      setFormData({ username: "", password: "", role: "ops" });
    } catch (error) {
      toast({
        title: "No se pudo crear usuario",
        description: String(error),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Equipo del Hotel</h2>
          <p className="text-slate-500 font-medium mt-3">
            Gestioná accesos, roles y permisos de seguridad para el personal.
          </p>
        </div>
        <Button className="bg-slate-900 h-12 px-6 rounded-xl shadow-xl shadow-slate-200 transition-all active:scale-95" onClick={() => setDrawerOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          <span className="font-black uppercase text-xs tracking-widest">Nuevo usuario</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20 text-slate-400 bg-white rounded-3xl shadow-sm border border-slate-100">
          <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card className="border-none shadow-2xl rounded-3xl p-20 text-center bg-white">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">Sin acceso configurado</p>
          <p className="text-slate-500 font-bold mt-2">Todavía no hay usuarios de sistema creados.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card
              key={user.id}
              className="border-none rounded-3xl p-8 bg-white shadow-xl shadow-slate-200/50 hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-slate-100 transition-colors" />
              <div className="flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-2xl shadow-slate-300 group-hover:scale-110 transition-transform duration-500 rotate-3">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full text-slate-300 hover:text-slate-900">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xl font-black text-slate-900 tracking-tight truncate capitalize">
                    {user.username}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-3.5 h-3.5 ${user.role === 'admin' ? 'text-blue-500' : 'text-amber-500'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'text-blue-600' : 'text-amber-600'}`}>
                      Rol: {user.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-500 pt-2">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                    <Fingerprint className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Acceso Habilitado</span>
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-300 tracking-tighter uppercase">ID: {user.id.slice(0,12)}</span>
                  <Button variant="ghost" className="h-8 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-900 transition-all">Configuración</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[420px] bg-white border-l shadow-2xl p-0 overflow-hidden flex flex-col">
          <div className="p-8 bg-slate-900 text-white">
            <SheetHeader>
              <SheetTitle className="text-2xl font-black text-white tracking-tight">Nuevo Usuario</SheetTitle>
              <SheetDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                Creación de credenciales de acceso
              </SheetDescription>
            </SheetHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-8 gap-8">
            <div className="flex-1 space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="user-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">ID de Usuario</Label>
                <Input
                  id="user-name"
                  value={formData.username}
                  onChange={(event) =>
                    setFormData({ ...formData, username: event.target.value })
                  }
                  required
                  placeholder="ej: marta_ops"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="user-password" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Contraseña Temporal</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData({ ...formData, password: event.target.value })
                  }
                  required
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="user-role" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Rol en el Sistema</Label>
                <select
                  id="user-role"
                  value={formData.role}
                  onChange={(event) =>
                    setFormData({ ...formData, role: event.target.value })
                  }
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold outline-none"
                >
                  <option value="ops">Operador (ops)</option>
                  <option value="admin">Administrador (admin)</option>
                </select>
              </div>
            </div>

            <SheetFooter className="mt-auto">
              <Button type="submit" disabled={saving} className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200 text-white font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95">
                {saving ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Creando Perfil...
                  </>
                ) : (
                  "Habilitar Acceso"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default UsersPage;
