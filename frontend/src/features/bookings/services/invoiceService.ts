import client from '@/api/client';
import { Invoice } from '@/types/domain';

export const getInvoices = async (): Promise<Invoice[]> => {
    const response = await client.get('/invoices');
    return response.data as Invoice[];
};

export const getInvoiceByBooking = async (bookingId: string): Promise<Invoice> => {
    const response = await client.get(`/bookings/${bookingId}/invoice`);
    return response.data as Invoice;
};

const invoiceService = {
    getInvoices,
    getInvoiceByBooking,
};

export default invoiceService;
