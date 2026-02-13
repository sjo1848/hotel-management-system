import React from "react";
import {
    Mail,
    Phone,
    Calendar,
    Clock,
    ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Guest } from "@/types/domain";

interface GuestDetailsSheetProps {
    guest: Guest | null;
    isOpen: boolean;
    onClose: () => void;
}

const GuestDetailsSheet: React.FC<GuestDetailsSheetProps> = ({
    guest,
    isOpen,
    onClose,
}) => {
    if (!guest) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md bg-white border-l shadow-2xl overflow-y-auto">
                <SheetHeader className="pb-6 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <Badge className="px-2.5 py-0.5 border font-medium flex items-center gap-1 bg-indigo-50 text-indigo-600 border-indigo-100">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Huésped Verificado
                        </Badge>
                        <span className="text-xs font-mono text-slate-400">ID: {guest.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <SheetTitle className="text-2xl font-bold text-slate-900">{guest.full_name}</SheetTitle>
                    <SheetDescription className="text-slate-500">
                        Perfil completo y registros históricos.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-8 space-y-8">
                    {/* Avatar y Datos Principales */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-black shadow-xl">
                            {guest.full_name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{guest.full_name}</h3>
                            <p className="text-slate-500 text-sm">Cliente Premium</p>
                        </div>
                    </div>

                    {/* Información de Contacto */}
                    <section className="space-y-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-2">Información de Contacto</div>
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Mail className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Email</p>
                                    <p className="text-sm font-medium text-slate-700">{guest.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <Phone className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Teléfono</p>
                                    <p className="text-sm font-medium text-slate-700">{guest.phone || "No registrado"}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Historial y Actividad */}
                    <section className="space-y-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b pb-2">Actividad en el Sistema</div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <Calendar className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Miembro desde</p>
                                <p className="text-sm font-medium text-slate-700">
                                    {guest.created_at ? format(new Date(guest.created_at), "PPP", { locale: es }) : "N/A"}
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-900">Módulo CRM en expansión</p>
                            <p className="text-xs text-amber-700">Próximamente podrás ver el historial completo de reservas y preferencias de habitación de este huésped.</p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default GuestDetailsSheet;
