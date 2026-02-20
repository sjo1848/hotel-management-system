import React from "react";
import {
    Calendar,
    User,
    DoorOpen,
    CreditCard,
    Clock,
    CheckCircle,
    XCircle,
    Mail,
    Phone,
    ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
    getInvoiceByBooking,
} from "@/features/bookings/services/invoiceService";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Booking, BookingStatus, Invoice } from "@/types/domain";
import { cn } from "@/lib/utils";

interface BookingDetailsSheetProps {
    booking: Booking | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus?: (id: string, status: BookingStatus) => Promise<void>;
}

const BookingDetailsSheet: React.FC<BookingDetailsSheetProps> = ({
    booking,
    isOpen,
    onClose,
    onUpdateStatus,
}) => {
    const [invoice, setInvoice] = React.useState<Invoice | null>(null);
    const [loadingInvoice, setLoadingInvoice] = React.useState(false);

    React.useEffect(() => {
        if (isOpen && booking?.status === "CheckedOut") {
            setLoadingInvoice(true);
            getInvoiceByBooking(booking.id)
                .then(setInvoice)
                .catch(console.error)
                .finally(() => setLoadingInvoice(false));
        } else if (!isOpen) {
            setInvoice(null);
        }
    }, [isOpen, booking?.id, booking?.status]);

    if (!booking) return null;

    const getStatusInfo = (status: BookingStatus) => {
        switch (status) {
            case "Confirmed":
                return { label: "Confirmada", color: "text-blue-600 bg-blue-50 border-blue-100", icon: Clock };
            case "CheckedIn":
                return { label: "En el Hotel", color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle };
            case "CheckedOut":
                return { label: "Finalizada", color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-slate-100 dark:border-slate-800", icon: CheckCircle };
            case "Cancelled":
                return { label: "Cancelada", color: "text-red-600 bg-red-50 border-red-100", icon: XCircle };
            default:
                return { label: status, color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border-slate-100 dark:border-slate-800", icon: Clock };
        }
    };

    const statusInfo = getStatusInfo(booking.status);
    const StatusIcon = statusInfo.icon;
    const invoiceStatusInfo = invoice
        ? invoice.status === "PAID"
            ? { label: "Pagada", className: "bg-emerald-600 text-white" }
            : invoice.status === "VOIDED"
                ? { label: "Anulada", className: "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600" }
                : { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" }
        : null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <Badge className={cn("px-2.5 py-0.5 border font-medium flex items-center gap-1", statusInfo.color)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusInfo.label}
                        </Badge>
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">REF: {booking.id.substring(0, 8).toUpperCase()}</span>
                    </div>
                    <SheetTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">Detalles de Reserva</SheetTitle>
                    <SheetDescription className="text-slate-500 dark:text-slate-400">
                        Información completa de la estancia y el huésped.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-8 space-y-8">
                    {/* Seccion: Huésped */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm uppercase tracking-wider">
                            <User className="w-4 h-4 text-secondary" />
                            Información del Huésped
                        </div>
                        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                            <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-lg">
                                {booking.guest_name.charAt(0)}
                            </div>
                            <div className="space-y-1">
                                <div className="font-bold text-slate-900 dark:text-slate-100 text-lg">{booking.guest_name}</div>
                                <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> guest@example.com
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5" /> +1 (555) 001-2233
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Seccion: Estancia */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm uppercase tracking-wider">
                            <Calendar className="w-4 h-4 text-secondary" />
                            Fechas de Estancia
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Check-in</p>
                                <p className="font-bold text-slate-900 dark:text-slate-100">{format(new Date(booking.check_in), "EEE, dd MMM yyyy", { locale: es })}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Desde las 15:00</p>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Check-out</p>
                                <p className="font-bold text-slate-900 dark:text-slate-100">{format(new Date(booking.check_out), "EEE, dd MMM yyyy", { locale: es })}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hasta las 11:00</p>
                            </div>
                        </div>
                    </section>

                    {/* Seccion: Habitación */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm uppercase tracking-wider">
                            <DoorOpen className="w-4 h-4 text-secondary" />
                            Habitación (ID: {booking.room_id.slice(0,4)})
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl text-white shadow-xl overflow-hidden relative group">
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-secondary opacity-10 group-hover:opacity-20 transition-opacity skew-x-12 -mr-8" />
                            <div className="relative z-10">
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">Total Reserva</div>
                                <div className="text-3xl font-black font-mono">${(booking.total_price_cents / 100).toLocaleString()}</div>
                            </div>
                        </div>
                    </section>

                    {/* Seccion: Pago */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm uppercase tracking-wider">
                            <CreditCard className="w-4 h-4 text-secondary" />
                            Resumen Financiero
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-white dark:bg-slate-900 flex justify-between items-center">
                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Total Estancia</span>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-secondary">${booking.total_price_cents / 100}</span>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">IVA Incluido</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Seccion: Factura (Solo si está disponible) */}
                    {(booking.status === "CheckedOut" || invoice) && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm uppercase tracking-wider">
                                <CreditCard className="w-4 h-4 text-emerald-600" />
                                Factura Generada
                            </div>
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <CheckCircle className="w-12 h-12 text-emerald-600" />
                                </div>

                                {loadingInvoice ? (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
                                    </div>
                                ) : invoice ? (
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] text-emerald-600 font-bold uppercase">Folio Fiscal</p>
                                                <p className="font-mono text-xs text-slate-600 dark:text-slate-300">{invoice.id.toUpperCase()}</p>
                                            </div>
                                            <Badge className={cn(
                                                "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                                invoiceStatusInfo?.className
                                            )}>
                                                {invoiceStatusInfo?.label}
                                            </Badge>
                                        </div>

                                        <div className="pt-2 flex justify-between items-end border-t border-emerald-100">
                                            <div>
                                                <p className="text-[10px] text-emerald-600 font-bold uppercase">Emitida el</p>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {format(new Date(invoice.created_at), "dd/MM/yyyy HH:mm")}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-emerald-600 font-bold uppercase">Total Facturado</p>
                                                <p className="text-2xl font-black text-emerald-700">${invoice.amount_cents / 100}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No se pudo cargar la información de la factura.</p>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                <SheetFooter className="pt-6 border-t border-slate-100 dark:border-slate-800 gap-2 sm:gap-0">
                    <div className="flex flex-col sm:flex-row w-full gap-2">
                        {(booking.status === "Confirmed") && (
                            <Button
                                className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 gap-2"
                                onClick={() => onUpdateStatus?.(booking.id, "CheckedIn")}
                            >
                                <CheckCircle className="w-4 h-4" /> Registrar Check-in
                            </Button>
                        )}

                        {(booking.status === "CheckedIn") && (
                            <Button
                                className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 gap-2"
                                onClick={() => onUpdateStatus?.(booking.id, "CheckedOut")}
                            >
                                <ArrowRight className="w-4 h-4" /> Registrar Check-out
                            </Button>
                        )}

                        {(booking.status === "Confirmed" || booking.status === "CheckedIn") && (
                            <Button
                                variant="outline"
                                className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 gap-2"
                                onClick={() => onUpdateStatus?.(booking.id, "Cancelled")}
                            >
                                <XCircle className="w-4 h-4" /> Cancelar
                            </Button>
                        )}

                        {booking.status === "CheckedOut" && (
                            <Button
                                variant="outline"
                                className="w-full pointer-events-none opacity-50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Completada
                            </Button>
                        )}
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};

export default BookingDetailsSheet;
