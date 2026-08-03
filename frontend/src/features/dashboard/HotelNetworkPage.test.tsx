import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HMSQueryProvider } from "@/lib/QueryProvider";
import { queryClient } from "@/lib/queryClient";
import HotelNetworkPage from "./HotelNetworkPage";

const mockTrackUiEvent = vi.fn();
const mockToast = vi.fn();
const mockGetHotels = vi.fn();
const mockGetHotelNetworkKpis = vi.fn();
const mockGetFeatureFlags = vi.fn();
const mockUpdateHotelPlanTier = vi.fn();
const mockCreateHotel = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackUiEvent: (...args: unknown[]) => mockTrackUiEvent(...args),
}));

vi.mock("./services/hotelService", () => ({
  getHotels: (...args: unknown[]) => mockGetHotels(...args),
  getHotelNetworkKpis: (...args: unknown[]) => mockGetHotelNetworkKpis(...args),
  getFeatureFlags: (...args: unknown[]) => mockGetFeatureFlags(...args),
  updateHotelPlanTier: (...args: unknown[]) => mockUpdateHotelPlanTier(...args),
  createHotel: (...args: unknown[]) => mockCreateHotel(...args),
}));

const baseHotels = [
  { id: "hotel-1", name: "Hotel Uno", address: "Av. Central 123" },
];

const baseSummary = {
  start: "2026-02-01",
  end: "2026-02-24",
  total_hotels: 1,
  total_active_bookings: 8,
  total_revenue_cents: 3250000,
  average_occupancy_rate: 68.5,
  hotels: [
    {
      hotel_id: "hotel-1",
      hotel_name: "Hotel Uno",
      plan_tier: "PRO" as const,
      occupancy_rate: 68.5,
      active_bookings_count: 8,
      revenue_cents: 3250000,
      adr_cents: 210000,
      rev_par_cents: 143850,
    },
  ],
};

const baseFlags = {
  hotel_id: "hotel-1",
  plan_tier: "PRO" as const,
  automation_alerts_enabled: true,
  pricing_assistant_enabled: true,
  hq_benchmark_enabled: true,
  advanced_analytics_enabled: true,
};

const renderPage = () =>
  render(
    <HMSQueryProvider>
      <MemoryRouter>
        <HotelNetworkPage />
      </MemoryRouter>
    </HMSQueryProvider>,
  );

const findHotelUnoOption = () =>
  screen.findByRole("option", { name: "Hotel Uno" }, { timeout: 5000 });

describe("HotelNetworkPage telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    mockGetHotels.mockResolvedValue(baseHotels);
    mockGetHotelNetworkKpis.mockResolvedValue(baseSummary);
    mockGetFeatureFlags.mockResolvedValue(baseFlags);
    mockUpdateHotelPlanTier.mockResolvedValue(baseFlags);
    mockCreateHotel.mockResolvedValue({
      id: "hotel-2",
      name: "Hotel Dos",
      address: "Av. Norte 55",
    });
  });

  it("tracks HQ KPI view telemetry event", async () => {
    renderPage();

    expect(await findHotelUnoOption()).toBeInTheDocument();

    await waitFor(() => {
      expect(mockTrackUiEvent).toHaveBeenCalledWith(
        "network_kpis_viewed",
        expect.objectContaining({
          selected_hotel_id: "all",
          total_hotels: 1,
          total_active_bookings: 8,
        }),
      );
    });
  });

  it(
    "tracks plan upgrade submitted and succeeded events",
    async () => {
      renderPage();
      expect(await findHotelUnoOption()).toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText(/propiedad/i), "hotel-1");
      await userEvent.selectOptions(screen.getByLabelText(/plan comercial/i), "ENTERPRISE");
      await userEvent.click(screen.getByRole("button", { name: /actualizar plan/i }));

      await waitFor(() => {
        expect(mockUpdateHotelPlanTier).toHaveBeenCalledWith("hotel-1", "ENTERPRISE");
      });

      await waitFor(() => {
        expect(mockTrackUiEvent).toHaveBeenCalledWith(
          "network_plan_upgrade_submitted",
          expect.objectContaining({
            hotel_id: "hotel-1",
            previous_plan_tier: "PRO",
            requested_plan_tier: "ENTERPRISE",
          }),
        );
      });

      await waitFor(() => {
        expect(mockTrackUiEvent).toHaveBeenCalledWith(
          "network_plan_upgrade_succeeded",
          expect.objectContaining({
            hotel_id: "hotel-1",
            previous_plan_tier: "PRO",
            updated_plan_tier: "ENTERPRISE",
          }),
        );
      });
    },
    10_000,
  );

  it("tracks plan upgrade submitted and failed events", async () => {
    mockUpdateHotelPlanTier.mockRejectedValueOnce(new Error("plan update failed"));
    renderPage();
    expect(await findHotelUnoOption()).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/propiedad/i), "hotel-1");
    await userEvent.selectOptions(screen.getByLabelText(/plan comercial/i), "ENTERPRISE");
    await userEvent.click(screen.getByRole("button", { name: /actualizar plan/i }));

    await waitFor(() => {
      expect(mockUpdateHotelPlanTier).toHaveBeenCalledWith("hotel-1", "ENTERPRISE");
    });

    await waitFor(() => {
      expect(mockTrackUiEvent).toHaveBeenCalledWith(
        "network_plan_upgrade_submitted",
        expect.objectContaining({
          hotel_id: "hotel-1",
          previous_plan_tier: "PRO",
          requested_plan_tier: "ENTERPRISE",
        }),
      );
    });

    await waitFor(() => {
      expect(mockTrackUiEvent).toHaveBeenCalledWith(
        "network_plan_upgrade_failed",
        expect.objectContaining({
          hotel_id: "hotel-1",
          previous_plan_tier: "PRO",
          requested_plan_tier: "ENTERPRISE",
        }),
      );
    });
  });
});
