import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "./DashboardHome";
import { invalidateResource } from "@/lib/useResourceQuery";
import { HMSQueryProvider } from "@/lib/QueryProvider";

const mockTrackUiEvent = vi.fn();
const mockToast = vi.fn();
const mockCloseCash = vi.fn();
const mockGetDashboardKpis = vi.fn();
const mockGetRevenueReport = vi.fn();
const mockGetOccupancyReport = vi.fn();
const mockGetCashBalance = vi.fn();
const mockGetFeatureFlags = vi.fn();
const mockGetDirtyRooms = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackUiEvent: (...args: unknown[]) => mockTrackUiEvent(...args),
}));

vi.mock("@/features/bookings/components/BookingList", () => ({
  default: () => <div data-testid="booking-list" />,
}));

vi.mock("@/features/bookings/components/BookingEditDrawer", () => ({
  default: () => null,
}));

vi.mock("./services/analyticsService", () => ({
  getDashboardKpis: (...args: unknown[]) => mockGetDashboardKpis(...args),
  getRevenueReport: (...args: unknown[]) => mockGetRevenueReport(...args),
  getOccupancyReport: (...args: unknown[]) => mockGetOccupancyReport(...args),
}));

vi.mock("./services/billingService", () => ({
  getCashBalance: (...args: unknown[]) => mockGetCashBalance(...args),
  closeCash: (...args: unknown[]) => mockCloseCash(...args),
}));

vi.mock("./services/hotelService", () => ({
  getFeatureFlags: (...args: unknown[]) => mockGetFeatureFlags(...args),
}));

vi.mock("@/features/housekeeping/services/housekeepingService", () => ({
  getDirtyRooms: (...args: unknown[]) => mockGetDirtyRooms(...args),
}));

vi.mock("recharts", () => {
  const Mock = (_props: { children?: ReactNode }) => <div />;
  return {
    ResponsiveContainer: Mock,
    AreaChart: Mock,
    Area: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    BarChart: Mock,
    Bar: Mock,
    Cell: Mock,
  };
});

const renderDashboard = () =>
  render(
    <HMSQueryProvider>
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>
    </HMSQueryProvider>,
  );

describe("DashboardHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateResource("dashboard:home");
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetDashboardKpis
      .mockResolvedValueOnce({
        revenue_month_cents: 10000,
        occupancy_rate: 10,
        today_check_ins: 1,
        active_bookings_count: 1,
        arrivals_today: [],
        departures_today: [],
        rev_par_cents: 1000,
        adr_cents: 10000,
      })
      .mockResolvedValueOnce({
        revenue_month_cents: 50000,
        occupancy_rate: 75,
        today_check_ins: 2,
        active_bookings_count: 3,
        arrivals_today: [],
        departures_today: [],
        rev_par_cents: 12500,
        adr_cents: 16666,
      });
    mockGetRevenueReport.mockResolvedValue([]);
    mockGetOccupancyReport.mockResolvedValue([]);
    mockGetCashBalance.mockResolvedValue({
      total_amount_cents: 15000,
      cash_amount_cents: 10000,
      card_amount_cents: 5000,
      payment_count: 2,
      opening_time: "2026-03-08T08:00:00Z",
      pending_amount_cents: 2500,
      pending_bookings_count: 1,
    });
    mockGetFeatureFlags.mockResolvedValue({
      hotel_id: "00000000-0000-0000-0000-000000000001",
      plan_tier: "PRO",
      automation_alerts_enabled: true,
      pricing_assistant_enabled: true,
      hq_benchmark_enabled: true,
      advanced_analytics_enabled: false,
    });
    mockGetDirtyRooms.mockResolvedValue([]);
    mockCloseCash.mockResolvedValue({ cash_difference_cents: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "refreshes dashboard data after close cash without hard reload",
    async () => {
      renderDashboard();

      await waitFor(() => {
        expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
      });

      const closeButton = screen.getByRole("button", { name: /finalizar turno y cerrar caja/i });
      await userEvent.click(closeButton);
      await userEvent.type(screen.getByLabelText(/entregar a/i), "Turno noche · Martina");
      await userEvent.type(screen.getByLabelText(/notas de entrega/i), "Sin novedades pendientes");
      await userEvent.click(screen.getByRole("button", { name: /confirmar arqueo y cerrar/i }));

      await waitFor(() => {
        expect(mockCloseCash).toHaveBeenCalledTimes(1);
        expect(mockCloseCash).toHaveBeenCalledWith({
          expected_cash_amount_cents: 10000,
          counted_cash_amount_cents: 10000,
          handoff_to: "Turno noche · Martina",
          notes: "Sin novedades pendientes",
        });
        expect(mockGetDashboardKpis).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_success", {
          total_amount_cents: 15000,
          cash_difference_cents: 0,
        });
      });
    },
    10_000,
  );

  it("shows retry UI when initial dashboard load fails", async () => {
    mockGetDashboardKpis.mockReset();
    mockGetDashboardKpis
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        revenue_month_cents: 20000,
        occupancy_rate: 50,
        today_check_ins: 1,
        active_bookings_count: 2,
        arrivals_today: [],
        departures_today: [],
        rev_par_cents: 5000,
        adr_cents: 10000,
      });

    renderDashboard();

    expect(
      await screen.findByText(/no se pudo cargar el dashboard\. reintentá\./i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(2);
    });
    expect(mockTrackUiEvent).toHaveBeenCalledWith("dashboard_load_failed", {
      message: "boom",
    });
    expect(mockTrackUiEvent).toHaveBeenCalledWith("dashboard_retry_clicked");
  });

  it("tracks close cash failure event", async () => {
    mockCloseCash.mockRejectedValueOnce(new Error("cash close failed"));
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    const closeButton = screen.getByRole("button", { name: /finalizar turno y cerrar caja/i });
    await userEvent.click(closeButton);
    await userEvent.type(screen.getByLabelText(/entregar a/i), "Turno noche");
    await userEvent.type(screen.getByLabelText(/notas de entrega/i), "Diferencia a revisar");
    await userEvent.click(screen.getByRole("button", { name: /confirmar arqueo y cerrar/i }));

    await waitFor(() => {
      expect(mockCloseCash).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_failure", {
      message: "cash close failed",
    });
  });
});
