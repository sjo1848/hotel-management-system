import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "@/api/client";
import { getInvoiceByBooking, getInvoices } from "./invoiceService";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("invoiceService contract mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps invoice status/method from backend payload on list endpoint", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: "inv-1",
          hotel_id: "hotel-1",
          booking_id: "booking-1",
          amount_cents: 1000,
          status: "PAID",
          payment_method: "CARD",
          created_at: "2026-02-20T00:00:00Z",
        },
      ],
    });

    const invoices = await getInvoices();

    expect(client.get).toHaveBeenCalledWith("/invoices", { params: undefined });
    expect(invoices[0]).toMatchObject({
      status: "PAID",
      payment_method: "CARD",
    });
  });

  it("normalizes legacy/non-standard invoice status/method values defensively", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: "inv-2",
        hotel_id: "hotel-1",
        booking_id: "booking-2",
        amount_cents: 2500,
        status: "paid",
        payment_method: "wire",
        created_at: "2026-02-20T01:00:00Z",
      },
    });

    const invoice = await getInvoiceByBooking("booking-2");

    expect(client.get).toHaveBeenCalledWith("/bookings/booking-2/invoice", { params: undefined });
    expect(invoice.status).toBe("PAID");
    expect(invoice.payment_method).toBe("CASH");
  });
});
