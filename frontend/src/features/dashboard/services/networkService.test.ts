import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/api/sdk";
import { getHotelNetworkSummary } from "./networkService";

vi.mock("@/api/sdk", () => ({
  apiGet: vi.fn(),
}));

describe("networkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests HQ summary with expected query params and maps payload", async () => {
    (apiGet as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      start: "2026-02-01",
      end: "2026-02-21",
      selected_hotel_id: null,
      totals: {
        hotels_count: 2,
        revenue_cents: 100000,
        bookings_count: 30,
        active_bookings_count: 8,
        today_check_ins: 4,
        avg_occupancy_rate: 71.2,
        avg_adr_cents: 4200,
        avg_rev_par_cents: 2980,
      },
      benchmarks: {
        top_revenue_hotel_id: "h1",
        top_occupancy_hotel_id: "h2",
        top_rev_par_hotel_id: "h1",
      },
      hotels: [
        {
          hotel_id: "h1",
          hotel_name: "Hotel Centro",
          hotel_address: "Av. Uno",
          plan_tier: "PRO",
          revenue_cents: 64000,
          bookings_count: 18,
          active_bookings_count: 5,
          today_check_ins: 3,
          occupancy_rate: 78.5,
          adr_cents: 4550,
          rev_par_cents: 3572,
        },
      ],
    });

    const response = await getHotelNetworkSummary({
      start: "2026-02-01",
      end: "2026-02-21",
      hotelId: "h1",
    });

    expect(apiGet).toHaveBeenCalledWith("/hotels/network/summary", {
      start: "2026-02-01",
      end: "2026-02-21",
      hotel_id: "h1",
    });
    expect(response.totals.revenue_cents).toBe(100000);
    expect(response.hotels[0].hotel_name).toBe("Hotel Centro");
    expect(response.benchmarks.top_occupancy_hotel_id).toBe("h2");
  });
});
