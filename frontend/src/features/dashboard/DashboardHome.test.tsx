import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "./DashboardHome";
import { invalidateResource } from "@/lib/useResourceQuery";

const mockTrackUiEvent = vi.fn();
const mockToast = vi.fn();
const mockCloseCash = vi.fn();
const mockGetDashboardKpis = vi.fn();
const mockGetRevenueReport = vi.fn();
const mockGetOccupancyReport = vi.fn();
const mockGetCashBalance = vi.fn();
const mockGetAutomationInsights = vi.fn();

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

vi.mock("./services/automationService", () => ({
  getAutomationInsights: (...args: unknown[]) => mockGetAutomationInsights(...args),
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
    mockGetDashboardKpis.mockReset();
    mockGetRevenueReport.mockReset();
    mockGetOccupancyReport.mockReset();
    mockGetCashBalance.mockReset();
    mockGetAutomationInsights.mockReset();
    mockCloseCash.mockReset();
    invalidateResource("dashboard:home");
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
        rev_par_cents: 4500,
        adr_cents: 9000,
      })
      .mockResolvedValueOnce({
        revenue_month_cents: 50000,
        occupancy_rate: 75,
        today_check_ins: 2,
        active_bookings_count: 3,
        arrivals_today: [],
        departures_today: [],
        rev_par_cents: 12000,
        adr_cents: 16000,
      });
    mockGetRevenueReport.mockResolvedValue([]);
    mockGetOccupancyReport.mockResolvedValue([]);
    mockGetCashBalance.mockResolvedValue({
      total_amount_cents: 15000,
      cash_amount_cents: 10000,
      card_amount_cents: 5000,
    });
    mockGetAutomationInsights.mockResolvedValue({
      plan_tier: "PRO",
      feature_flags: {
        revenue_cockpit: true,
        housekeeping_sla_alerts: true,
        pricing_assistant: true,
        exception_notifications: true,
        hq_multi_property: true,
        benchmarking_exports: false,
        pricing_rules_automation: false,
      },
      housekeeping_sla: {
        enabled: true,
        dirty_rooms_count: 0,
        cleaning_rooms_count: 0,
        overdue_rooms_count: 0,
        recommendation: "OK",
      },
      pricing_assistant: {
        enabled: true,
        occupancy_rate: 70,
        adr_cents: 12000,
        rev_par_cents: 8400,
        urgency: "low",
        recommendation: "OK",
      },
      exception_notifications: [],
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
    expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_success", {
      total_amount_cents: 15000,
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
        rev_par_cents: 7000,
        adr_cents: 11000,
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

    await waitFor(() => {
      expect(mockCloseCash).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_failure", {
      message: "cash close failed",
    });
  });

  it("tracks revenue cockpit adoption and CTA action", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    expect(mockTrackUiEvent).toHaveBeenCalledWith("revenue_cockpit_viewed", {
      occupancy_rate: 10,
      adr_cents: 9000,
      rev_par_cents: 4500,
      active_bookings_count: 1,
    });

    await userEvent.click(
      screen.getByRole("button", { name: /ver reporte de revenue/i }),
    );

    expect(mockTrackUiEvent).toHaveBeenCalledWith("revenue_cockpit_cta_clicked", {
      action_id: "raise_occupancy_72h",
      route: "/reports",
    });
  });
});
