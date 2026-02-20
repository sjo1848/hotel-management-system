import { beforeEach, describe, expect, it, vi } from "vitest";
import client from "@/api/client";
import { getRevenueReport } from "./reportingService";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("reportingService revenue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports backend revenue_cents response shape", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ date: "2026-02-19", revenue_cents: 50000 }],
    });

    const data = await getRevenueReport("2026-02-01", "2026-02-19");

    expect(client.get).toHaveBeenCalledWith("/reports/revenue", {
      params: { start: "2026-02-01", end: "2026-02-19" },
    });
    expect(data).toEqual([{ date: "2026-02-19", amount_cents: 50000 }]);
  });

  it("falls back to 0 when neither amount_cents nor revenue_cents are provided", async () => {
    (client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ date: "2026-02-19" }],
    });

    const data = await getRevenueReport();

    expect(data).toEqual([{ date: "2026-02-19", amount_cents: 0 }]);
  });
});
