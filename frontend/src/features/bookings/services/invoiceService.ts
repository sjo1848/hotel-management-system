import client from '../../../api/client';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'VOIDED';

export interface Invoice {
    id: string;
    booking_id: string;
    amount_cents: number;
    status: InvoiceStatus;
    created_at: string;
}

export const getInvoices = async () => {
    const response = await client.get('/invoices');
    return response.data as Invoice[];
};

export const getInvoiceByBooking = async (bookingId: string) => {
    const response = await client.get(`/bookings/${bookingId}/invoice`);
    return response.data as Invoice;
};
