import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPatch } from "@/api/sdk";
import { getBookings, updateBooking } from "./bookingService";

vi.mock("@/api/sdk", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

describe("bookingService contract mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes booking status variants on list endpoint", async () => {
    (apiGet as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "b1",
        hotel_id: "h1",
        room_id: "r1",
        guest_id: undefined,
        guest_name: "Guest",
        check_in: "2026-02-20",
        check_out: "2026-02-21",
        total_price_cents: 1000,
        status: "CHECKED_IN",
      },
    ]);

    const bookings = await getBookings();

    expect(apiGet).toHaveBeenCalledWith("/bookings", { start: undefined, end: undefined });
    expect(bookings[0]).toMatchObject({
      status: "CheckedIn",
      guest_id: null,
    });
  });

  it("normalizes booking status on update endpoint response", async () => {
    (apiPatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "b2",
      hotel_id: "h1",
      room_id: "r1",
      guest_id: null,
      guest_name: "Guest",
      check_in: "2026-02-20",
      check_out: "2026-02-21",
      total_price_cents: 1000,
      status: "CANCELLED",
    });

    const booking = await updateBooking("b2", { status: "Cancelled" });

    expect(apiPatch).toHaveBeenCalledWith("/bookings/b2", { status: "Cancelled" });
    expect(booking.status).toBe("Cancelled");
  });
});
