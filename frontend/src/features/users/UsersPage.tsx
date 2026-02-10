import React, { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Usuarios</h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestioná accesos y roles del equipo.
          </p>
        </div>
        <Button className="bg-slate-900" onClick={() => setDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      <Card className="p-6 border border-slate-200 shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10 text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            Todavía no hay usuarios creados.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {user.username}
                </div>
                <div className="text-xs text-slate-500 mt-1">{user.role}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Nuevo usuario</SheetTitle>
            <SheetDescription>
              Definí credenciales y rol de acceso.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="user-name">Usuario</Label>
              <Input
                id="user-name"
                value={formData.username}
                onChange={(event) =>
                  setFormData({ ...formData, username: event.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-password">Contraseña</Label>
              <Input
                id="user-password"
                type="password"
                value={formData.password}
                onChange={(event) =>
                  setFormData({ ...formData, password: event.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-role">Rol</Label>
              <Input
                id="user-role"
                value={formData.role}
                onChange={(event) =>
                  setFormData({ ...formData, role: event.target.value })
                }
                placeholder="admin u ops"
              />
            </div>

            <SheetFooter>
              <Button type="submit" disabled={saving} className="w-full bg-slate-900">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear usuario"
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
