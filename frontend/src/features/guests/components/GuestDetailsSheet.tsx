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
            <SheetContent className="w-full overflow-hidden border-l border-border bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-md">
                <div className="flex min-h-0 flex-1 flex-col">
                <SheetHeader className="border-b border-border px-4 py-5 sm:px-6 sm:py-6">
                    <div className="flex items-center justify-between mb-2">
                        <Badge className="flex items-center gap-1 border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Ficha de huésped
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">ID: {guest.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <SheetTitle className="text-2xl font-bold text-foreground">{guest.full_name}</SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                        Datos de contacto disponibles en el contrato V1.
                    </SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 overflow-y-auto space-y-8 px-4 py-6 sm:px-6 sm:py-8">
                    {/* Avatar y Datos Principales */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary via-primary/80 to-cyan-500 text-4xl font-black text-primary-foreground shadow-xl shadow-primary/20">
                            {guest.full_name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">{guest.full_name}</h3>
                            <p className="text-sm text-muted-foreground">Perfil de contacto</p>
                        </div>
                    </div>

                    {/* Información de Contacto */}
                    <section className="space-y-4">
                        <div className="border-b border-border pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Información de Contacto</div>
                        <div className="grid gap-4">
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                                <div className="rounded-lg border border-border bg-background/80 p-2 shadow-sm">
                                    <Mail className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p>
                                    <p className="text-sm font-medium text-foreground">{guest.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                                <div className="rounded-lg border border-border bg-background/80 p-2 shadow-sm">
                                    <Phone className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono</p>
                                    <p className="text-sm font-medium text-foreground">{guest.phone || "No registrado"}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Historial y Actividad */}
                    <section className="space-y-4">
                        <div className="border-b border-border pb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Registro en el sistema</div>
                        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                            <div className="rounded-lg border border-border bg-background/80 p-2 shadow-sm">
                                <Calendar className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Miembro desde</p>
                                <p className="text-sm font-medium text-foreground">
                                    {guest.created_at ? format(new Date(guest.created_at), "PPP", { locale: es }) : "N/A"}
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Alcance de la ficha V1</p>
                            <p className="text-xs text-amber-700/90 dark:text-amber-200/90">Documento, preferencias e historial consolidado requieren una política CRM específica y no se presentan como datos disponibles en esta versión.</p>
                        </div>
                    </div>
                </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default GuestDetailsSheet;
