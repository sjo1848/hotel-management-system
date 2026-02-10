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
import { getGuests, createGuest } from "./services/guestService";
import { useToast } from "@/components/ui/toast";

const GuestsPage = () => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    getGuests()
      .then(setGuests)
      .catch(() =>
        toast({
          title: "No se pudieron cargar huéspedes",
          description: "Reintentá en unos segundos.",
          variant: "error",
        }),
      )
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createGuest({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
      });
      setGuests((current) => [created, ...current]);
      toast({
        title: "Huésped creado",
        description: "Se agregó correctamente.",
        variant: "success",
      });
      setDrawerOpen(false);
      setFormData({ full_name: "", email: "", phone: "" });
    } catch (error) {
      toast({
        title: "No se pudo crear huésped",
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
          <h2 className="text-2xl font-semibold text-slate-900">Huéspedes</h2>
          <p className="text-sm text-slate-500 mt-1">
            Administrá la base de huéspedes frecuentes y nuevos registros.
          </p>
        </div>
        <Button className="bg-slate-900" onClick={() => setDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo huésped
        </Button>
      </div>

      <Card className="p-6 border border-slate-200 shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10 text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : guests.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            Todavía no hay huéspedes cargados.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {guest.full_name}
                </div>
                <div className="text-xs text-slate-500 mt-1">{guest.email}</div>
                {guest.phone ? (
                  <div className="text-xs text-slate-400 mt-1">{guest.phone}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="sm:max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Nuevo huésped</SheetTitle>
            <SheetDescription>
              Completá los datos básicos para agregarlo.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="guest-name">Nombre completo</Label>
              <Input
                id="guest-name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="guest-phone">Teléfono</Label>
              <Input
                id="guest-phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+54 11 1234 5678"
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
                  "Crear huésped"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default GuestsPage;
