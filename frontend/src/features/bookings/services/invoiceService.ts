import client from '@/api/client';
import { Invoice, PaymentEntry, PaymentMethod } from '@/types/domain';
import { emitDomainEvent } from "@/lib/domainEvents";

export const getInvoices = async (): Promise<Invoice[]> => {
    const response = await client.get('/invoices');
    return response.data as Invoice[];
};

export const getInvoiceByBooking = async (bookingId: string): Promise<Invoice | null> => {
    const response = await client.get(`/bookings/${bookingId}/invoice`, {
        validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    });
    return response.status === 404 ? null : response.data as Invoice;
};

export const settleBookingPayment = async (
    bookingId: string,
    payment_method: PaymentMethod,
    payment_reference?: string,
): Promise<Invoice> => {
    const response = await client.post(`/bookings/${bookingId}/settle-payment`, {
        payment_method,
        payment_reference: payment_reference?.trim() || undefined,
    });
    emitDomainEvent("billing.changed", { action: "invoice_settled", booking_id: bookingId });
    return response.data as Invoice;
};

export const getBookingPayments = async (bookingId: string): Promise<PaymentEntry[]> => {
    const response = await client.get(`/bookings/${bookingId}/payments`);
    return response.data as PaymentEntry[];
};

export const registerBookingPayment = async (
    bookingId: string,
    amount_cents: number,
    payment_method: PaymentMethod,
    payment_reference?: string,
    note?: string,
): Promise<Invoice> => {
    const response = await client.post(`/bookings/${bookingId}/payments`, {
        amount_cents,
        payment_method,
        payment_reference: payment_reference?.trim() || undefined,
        note: note?.trim() || undefined,
    });
    emitDomainEvent("billing.changed", { action: "payment_recorded", booking_id: bookingId });
    return response.data as Invoice;
};

const invoiceService = {
    getInvoices,
    getInvoiceByBooking,
    getBookingPayments,
    registerBookingPayment,
    settleBookingPayment,
};

export default invoiceService;
