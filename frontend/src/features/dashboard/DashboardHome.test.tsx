import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "./DashboardHome";

const mockToast = vi.fn();
const mockCloseCash = vi.fn();
const mockGetDashboardKpis = vi.fn();
const mockGetRevenueReport = vi.fn();
const mockGetOccupancyReport = vi.fn();
const mockGetCashBalance = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
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
    <MemoryRouter>
      <DashboardHome />
    </MemoryRouter>,
  );

describe("DashboardHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetDashboardKpis
      .mockResolvedValueOnce({
        revenue_month_cents: 10000,
        occupancy_rate: 10,
        today_check_ins: 1,
        active_bookings_count: 1,
        arrivals_today: [],
        departures_today: [],
      })
      .mockResolvedValueOnce({
        revenue_month_cents: 50000,
        occupancy_rate: 75,
        today_check_ins: 2,
        active_bookings_count: 3,
        arrivals_today: [],
        departures_today: [],
      });
    mockGetRevenueReport.mockResolvedValue([]);
    mockGetOccupancyReport.mockResolvedValue([]);
    mockGetCashBalance.mockResolvedValue({
      total_amount_cents: 15000,
      cash_amount_cents: 10000,
      card_amount_cents: 5000,
    });
    mockCloseCash.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes dashboard data after close cash without hard reload", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    const closeButton = screen.getByRole("button", { name: /finalizar turno y cerrar caja/i });
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(mockCloseCash).toHaveBeenCalledTimes(1);
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(2);
    });
  });

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
      });

    renderDashboard();

    expect(
      await screen.findByText(/no se pudo cargar el dashboard\. reintentá\./i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(2);
    });
  });
});
