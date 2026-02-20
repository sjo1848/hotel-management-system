import { apiGet } from "@/api/sdk";
import { Invoice } from "@/types/domain";
import type { components } from "@/api/generated/openapi";

type InvoiceRaw = components["schemas"]["Invoice"];

const normalizeInvoiceStatus = (status: string | undefined): Invoice["status"] => {
    const normalized = status?.toUpperCase();
    if (normalized === "PAID") return "PAID";
    if (normalized === "VOIDED") return "VOIDED";
    return "PENDING";
};

const normalizePaymentMethod = (method: string | undefined): Invoice["payment_method"] => {
    const normalized = method?.toUpperCase();
    if (normalized === "CARD") return "CARD";
    if (normalized === "TRANSFER") return "TRANSFER";
    return "CASH";
};

const toInvoice = (raw: InvoiceRaw): Invoice => ({
    id: raw.id ?? "",
    hotel_id: raw.hotel_id ?? "",
    booking_id: raw.booking_id ?? "",
    amount_cents: raw.amount_cents ?? 0,
    status: normalizeInvoiceStatus(raw.status),
    payment_method: normalizePaymentMethod(raw.payment_method),
    created_at: raw.created_at ?? "",
});

export const getInvoices = async (): Promise<Invoice[]> => {
    const response = await apiGet<InvoiceRaw[]>("/invoices");
    return (response ?? []).map(toInvoice);
};

export const getInvoiceByBooking = async (bookingId: string): Promise<Invoice> => {
    const response = await apiGet<InvoiceRaw>(`/bookings/${bookingId}/invoice`);
    return toInvoice(response);
};

const invoiceService = {
    getInvoices,
    getInvoiceByBooking,
};

export default invoiceService;
