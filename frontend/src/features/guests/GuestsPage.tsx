import React, { useEffect, useState } from "react";
import { Plus, Loader2, Mail, Phone, User as UserIcon, MoreHorizontal, ShieldCheck } from "lucide-react";
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
import { Guest, getGuests, createGuest } from "./services/guestService";
import { useToast } from "@/components/ui/toast";

const GuestsPage = () => {
  const [guests, setGuests] = useState<Guest[]>([]);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none text-slate-900">Huéspedes</h2>
          <p className="text-slate-500 font-medium mt-3">
            Administrá la base de huéspedes y registros históricos del hotel.
          </p>
        </div>
        <Button className="bg-slate-900 h-12 px-6 rounded-xl shadow-xl shadow-slate-200 transition-all active:scale-95" onClick={() => setDrawerOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          <span className="font-black uppercase text-xs tracking-widest">Nuevo huésped</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20 text-slate-400 bg-white rounded-3xl shadow-sm border border-slate-100">
          <Loader2 className="animate-spin w-10 h-10 text-primary" />
        </div>
      ) : guests.length === 0 ? (
        <Card className="border-none shadow-2xl rounded-3xl p-20 text-center bg-white">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <UserIcon className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">Base de datos vacía</p>
          <p className="text-slate-500 font-bold mt-2">Todavía no hay huéspedes cargados en el sistema.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {guests.map((guest) => (
            <Card
              key={guest.id}
              className="border-none rounded-3xl p-8 bg-white shadow-xl shadow-slate-200/50 hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -mr-16 -mt-16 group-hover:bg-slate-100 transition-colors" />
              <div className="flex flex-col gap-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-2xl shadow-slate-300 group-hover:scale-110 transition-transform duration-500 rotate-3">
                    {guest.full_name.charAt(0)}
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full text-slate-300 hover:text-slate-900">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </div>
                
                <div className="space-y-1">
                  <div className="text-xl font-black text-slate-900 tracking-tight truncate">
                    {guest.full_name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Huésped Verificado</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 text-slate-500 group-hover:text-slate-900 transition-colors">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold truncate">{guest.email}</span>
                  </div>
                  {guest.phone && (
                    <div className="flex items-center gap-3 text-slate-500 group-hover:text-slate-900 transition-colors">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">{guest.phone}</span>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-300 tracking-tighter uppercase">UID: {guest.id.slice(0,12)}</span>
                  <Button variant="ghost" className="h-8 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-900 transition-all">Perfil</Button>
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
              <SheetTitle className="text-2xl font-black text-white tracking-tight">Nuevo Huésped</SheetTitle>
              <SheetDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                Alta de registro en sistema
              </SheetDescription>
            </SheetHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-8 gap-8">
            <div className="flex-1 space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="guest-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nombre Completo</Label>
                <Input
                  id="guest-name"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  required
                  placeholder="Juan Manuel Pérez"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-email" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Correo Electrónico</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="juan@perez.com"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-phone" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Teléfono Móvil</Label>
                <Input
                  id="guest-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+54 11 1234 5678"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-colors px-4 font-bold"
                />
              </div>
            </div>

            <SheetFooter className="mt-auto">
              <Button type="submit" disabled={saving} className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200 text-white font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95">
                {saving ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Crear Registro"
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
