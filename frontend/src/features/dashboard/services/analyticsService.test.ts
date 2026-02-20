import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "@/api/client";
import { getRevenueReport } from "./analyticsService";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("analyticsService revenue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps backend revenue_cents into amount_cents", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ date: "2026-02-20", revenue_cents: 12345 }],
    });

    const data = await getRevenueReport("2026-02-01", "2026-02-20");

    expect(client.get).toHaveBeenCalledWith("/reports/revenue", {
      params: { start: "2026-02-01", end: "2026-02-20" },
    });
    expect(data).toEqual([{ date: "2026-02-20", amount_cents: 12345 }]);
  });

  it("preserves amount_cents when payload already matches frontend contract", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ date: "2026-02-20", amount_cents: 999 }],
    });

    const data = await getRevenueReport();

    expect(data).toEqual([{ date: "2026-02-20", amount_cents: 999 }]);
  });
});
