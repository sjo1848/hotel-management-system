import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "@/api/client";
import { getInvoiceByBooking } from "./invoiceService";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("invoiceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats a missing booking invoice as an expected empty state", async () => {
    vi.mocked(client.get).mockResolvedValue({ status: 404, data: {} });

    await expect(getInvoiceByBooking("booking-1")).resolves.toBeNull();
    expect(client.get).toHaveBeenCalledWith(
      "/bookings/booking-1/invoice",
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );

    const requestConfig = vi.mocked(client.get).mock.calls[0][1];
    expect(requestConfig?.validateStatus?.(404)).toBe(true);
    expect(requestConfig?.validateStatus?.(500)).toBe(false);
  });
});
