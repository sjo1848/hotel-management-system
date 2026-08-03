import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "./DashboardHome";
import { invalidateResource } from "@/lib/useResourceQuery";
import { HMSQueryProvider } from "@/lib/QueryProvider";
import { queryClient } from "@/lib/queryClient";
import { getReportRange } from "@/features/dashboard/utils/reportRange";

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

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
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
    LineChart: Mock,
    Line: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
  };
});

const defaultKpis = {
  revenue_month_cents: 10000,
  occupancy_rate: 10,
  today_check_ins: 1,
  active_bookings_count: 1,
  arrivals_today: [],
  departures_today: [],
  rev_par_cents: 1000,
  adr_cents: 10000,
};

const defaultBalance = {
  total_amount_cents: 15000,
  cash_amount_cents: 10000,
  card_amount_cents: 5000,
  payment_count: 2,
  opening_time: "2026-03-08T08:00:00Z",
  pending_amount_cents: 2500,
  pending_bookings_count: 1,
};

const defaultFlags = {
  hotel_id: "00000000-0000-0000-0000-000000000001",
  plan_tier: "PRO",
  automation_alerts_enabled: true,
  pricing_assistant_enabled: true,
  hq_benchmark_enabled: true,
  advanced_analytics_enabled: false,
};

const renderDashboard = () =>
  render(
    <HMSQueryProvider>
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>
    </HMSQueryProvider>,
  );

const range30 = getReportRange("30d");
const range7 = getReportRange("7d");

describe("DashboardHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    invalidateResource("dashboard:kpis");
    invalidateResource("dashboard:cash-balance");
    invalidateResource("feature-flags:current");
    invalidateResource("automation:dirty-rooms");
    invalidateResource(`dashboard:revenue:${range30.start}:${range30.end}`);
    invalidateResource(`dashboard:revenue:${range7.start}:${range7.end}`);
    invalidateResource(`dashboard:occupancy:${range30.start}:${range30.end}`);
    invalidateResource(`dashboard:occupancy:${range7.start}:${range7.end}`);
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetDashboardKpis.mockResolvedValue(defaultKpis);
    mockGetRevenueReport.mockResolvedValue([]);
    mockGetOccupancyReport.mockResolvedValue([]);
    mockGetCashBalance.mockResolvedValue(defaultBalance);
    mockGetFeatureFlags.mockResolvedValue(defaultFlags);
    mockGetDirtyRooms.mockResolvedValue([]);
    mockCloseCash.mockResolvedValue({ cash_difference_cents: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests KPIs and cash balance on initial load, not reports", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
      expect(mockGetCashBalance).toHaveBeenCalledTimes(1);
    });
    expect(mockGetRevenueReport).not.toHaveBeenCalled();
    expect(mockGetOccupancyReport).not.toHaveBeenCalled();
  });

  it("keeps the header and skeletons visible while loading without fake zeros", async () => {
    renderDashboard();
    expect(screen.getByRole("heading", { level: 1, name: /Centro de control/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Operación" })).toBeInTheDocument();
    expect(screen.getByText("Necesita atención")).toBeInTheDocument();
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
  });

  it("loads both reports only when the Rendimiento tab is opened with default 30-day range", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });
    expect(mockGetRevenueReport).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("tab", { name: "Rendimiento" }));

    await waitFor(() => {
      expect(mockGetRevenueReport).toHaveBeenCalledTimes(1);
      expect(mockGetOccupancyReport).toHaveBeenCalledTimes(1);
    });
    expect(mockGetRevenueReport).toHaveBeenCalledWith(range30.start, range30.end);
    expect(mockGetOccupancyReport).toHaveBeenCalledWith(range30.start, range30.end);
  });

  it("switches range to 7 days keeping the operation tab intact", async () => {
    renderDashboard();
    await userEvent.click(screen.getByRole("tab", { name: "Rendimiento" }));
    await waitFor(() => {
      expect(mockGetRevenueReport).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole("button", { name: "7 días" }));

    await waitFor(() => {
      expect(mockGetRevenueReport).toHaveBeenCalledWith(range7.start, range7.end);
      expect(mockGetOccupancyReport).toHaveBeenCalledWith(range7.start, range7.end);
    });
  });

  it("refresh re-queries only active resources without reloading the page", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(screen.getByRole("button", { name: /Actualizar/ }));

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(2);
      expect(mockGetCashBalance).toHaveBeenCalledTimes(2);
    });
    expect(mockGetRevenueReport).not.toHaveBeenCalled();
  });

  it("keeps the cash block visible when KPIs fail", async () => {
    mockGetDashboardKpis.mockReset();
    mockGetDashboardKpis.mockRejectedValue(new Error("boom"));

    renderDashboard();

    expect(
      await screen.findByText(/No se pudo cargar el pulso operativo/),
    ).toBeInTheDocument();
    expect(await screen.findByText("$150,00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(mockTrackUiEvent).toHaveBeenCalledWith("dashboard_retry_clicked");
  });

  it("keeps operational priorities visible when cash balance fails, with local retry", async () => {
    mockGetCashBalance.mockReset();
    mockGetCashBalance.mockRejectedValue(new Error("cash boom"));

    renderDashboard();

    expect(await screen.findByText("Necesita atención")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Reintentar caja/ })).toBeInTheDocument();
    expect(mockTrackUiEvent).not.toHaveBeenCalledWith("dashboard_load_failed", expect.anything());

    await userEvent.click(screen.getByRole("button", { name: /Reintentar caja/ }));
    await waitFor(() => {
      expect(mockGetCashBalance).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps the operational base when feature flags fail", async () => {
    mockGetFeatureFlags.mockReset();
    mockGetFeatureFlags.mockRejectedValue(new Error("flags boom"));

    renderDashboard();

    expect(await screen.findByText("Necesita atención")).toBeInTheDocument();
    expect(screen.queryByText(/Automatizaciones activas/)).not.toBeInTheDocument();
    expect(mockGetDirtyRooms).not.toHaveBeenCalled();
  });

  it("closes the cash shift preserving the exact request, toast, telemetry and refetch", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    const closeButton = await screen.findByRole("button", { name: /Cerrar turno/ });
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
      expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_success", {
        total_amount_cents: 15000,
        cash_difference_cents: 0,
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Turno cerrado" }),
    );
  }, 20_000);

  it("keeps the sheet open on failure and allows retrying", async () => {
    mockCloseCash.mockRejectedValueOnce(new Error("cash close failed"));
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    const closeButton = await screen.findByRole("button", { name: /Cerrar turno/ });
    await userEvent.click(closeButton);
    await userEvent.type(screen.getByLabelText(/entregar a/i), "Turno noche");
    await userEvent.type(screen.getByLabelText(/notas de entrega/i), "Diferencia a revisar");
    await userEvent.click(screen.getByRole("button", { name: /confirmar arqueo y cerrar/i }));

    await waitFor(() => {
      expect(mockTrackUiEvent).toHaveBeenCalledWith("close_cash_failure", {
        message: "cash close failed",
      });
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error" }),
    );
    expect(screen.getByRole("button", { name: /confirmar arqueo y cerrar/i })).toBeInTheDocument();
  }, 20_000);

  it("prevents a double submit from creating two close requests", async () => {
    let resolveClose!: (value: { cash_difference_cents: number }) => void;
    mockCloseCash.mockReturnValue(
      new Promise<{ cash_difference_cents: number }>((resolve) => {
        resolveClose = resolve;
      }),
    );
    renderDashboard();

    await waitFor(() => {
      expect(mockGetDashboardKpis).toHaveBeenCalledTimes(1);
    });

    const closeButton = await screen.findByRole("button", { name: /Cerrar turno/ });
    await userEvent.click(closeButton);
    await userEvent.type(screen.getByLabelText(/entregar a/i), "Turno noche");
    await userEvent.type(screen.getByLabelText(/notas de entrega/i), "Notas de entrega");
    const confirm = screen.getByRole("button", { name: /confirmar arqueo y cerrar/i });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(mockCloseCash).toHaveBeenCalledTimes(1);
    });
    resolveClose({ cash_difference_cents: 0 });
  }, 20_000);

  it("exposes accessible tabs and supports arrow and Home/End navigation", async () => {
    renderDashboard();
    const tablist = screen.getByRole("tablist", { name: /Secciones del centro de control/ });
    expect(tablist).toBeInTheDocument();

    const operationTab = screen.getByRole("tab", { name: "Operación" });
    const performanceTab = screen.getByRole("tab", { name: "Rendimiento" });
    expect(operationTab).toHaveAttribute("aria-selected", "true");
    expect(performanceTab).toHaveAttribute("aria-selected", "false");

    operationTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(performanceTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "dashboard-panel-performance");

    performanceTab.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(operationTab).toHaveAttribute("aria-selected", "true");

    operationTab.focus();
    await userEvent.keyboard("{End}");
    expect(performanceTab).toHaveAttribute("aria-selected", "true");
    performanceTab.focus();
    await userEvent.keyboard("{Home}");
    expect(operationTab).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the inactive panel hidden from interactive content", async () => {
    renderDashboard();
    const panels = screen.getAllByRole("tabpanel");
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveAttribute("id", "dashboard-panel-operation");
    expect(panels[0]).not.toHaveAttribute("hidden");
    expect(screen.queryByRole("tabpanel", { name: "Rendimiento" })).not.toBeInTheDocument();
  });
});
