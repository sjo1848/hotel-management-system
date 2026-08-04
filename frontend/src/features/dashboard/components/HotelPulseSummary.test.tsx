import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HotelPulseSummary from "./HotelPulseSummary";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";

const kpis = (overrides: Partial<DashboardKpis> = {}): DashboardKpis => ({
  revenue_month_cents: 1_000_000,
  occupancy_rate: 78,
  today_check_ins: 2,
  active_bookings_count: 40,
  arrivals_today: [
    { booking_id: "a", guest_name: "Ana", room_number: "101", status: "CONFIRMED" },
    { booking_id: "b", guest_name: "Bruno", room_number: "102", status: "CONFIRMED" },
  ],
  departures_today: [
    { booking_id: "c", guest_name: "Carla", room_number: "103", status: "CHECKED_IN" },
  ],
  rev_par_cents: 50_000,
  adr_cents: 90_000,
  ...overrides,
});

describe("HotelPulseSummary", () => {
  it("renders at most four indicators", () => {
    render(<HotelPulseSummary kpis={kpis()} loading={false} />);
    const labels = screen
      .getAllByText(/Ocupación|Llegadas|Salidas|Reservas activas/)
      .filter((node) => node.tagName === "P");
    expect(labels.length).toBe(4);
  });

  it("labels temporal context for each indicator", () => {
    render(<HotelPulseSummary kpis={kpis()} loading={false} />);
    expect(screen.getAllByText("Hoy", { exact: true })).toHaveLength(3);
    expect(screen.getByText("Total", { exact: true })).toBeInTheDocument();
  });

  it("shows a real zero only after data is loaded", () => {
    const { rerender } = render(<HotelPulseSummary kpis={null} loading />);
    expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    rerender(<HotelPulseSummary kpis={kpis({ arrivals_today: [] })} loading={false} />);
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
  });

  it("never renders trend arrows or fabricated deltas", () => {
    render(<HotelPulseSummary kpis={kpis()} loading={false} />);
    expect(screen.queryByText("↑")).not.toBeInTheDocument();
    expect(screen.queryByText("↓")).not.toBeInTheDocument();
    expect(screen.queryByText(/12%|4%/)).not.toBeInTheDocument();
  });

  it("keeps the arrivals counter consistent with the arrivals list", () => {
    const withTwo = kpis({ arrivals_today: kpis().arrivals_today });
    const { unmount } = render(<HotelPulseSummary kpis={withTwo} loading={false} />);
    expect(screen.getByText("2", { exact: true })).toBeInTheDocument();
    unmount();
    render(<HotelPulseSummary kpis={kpis({ arrivals_today: [] })} loading={false} />);
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
  });
});
