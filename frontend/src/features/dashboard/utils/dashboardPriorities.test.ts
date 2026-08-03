import { describe, expect, it } from "vitest";
import {
  buildDashboardPriorities,
  getRouteCapability,
  MAX_PRIORITIES,
  SEVERITY_LABEL,
} from "./dashboardPriorities";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";
import type { CashBalance } from "@/features/dashboard/services/billingService";
import type { TenantFeatureFlags } from "@/features/dashboard/services/hotelService";

const kpis = (overrides: Partial<DashboardKpis> = {}): DashboardKpis => ({
  revenue_month_cents: 1_000_000,
  occupancy_rate: 78,
  today_check_ins: 2,
  active_bookings_count: 40,
  arrivals_today: [],
  departures_today: [],
  rev_par_cents: 50_000,
  adr_cents: 90_000,
  ...overrides,
});

const flags = (overrides: Partial<TenantFeatureFlags> = {}): TenantFeatureFlags => ({
  hotel_id: "00000000-0000-0000-0000-000000000001",
  plan_tier: "PRO",
  automation_alerts_enabled: true,
  pricing_assistant_enabled: true,
  hq_benchmark_enabled: true,
  advanced_analytics_enabled: false,
  ...overrides,
});

const balance = (overrides: Partial<CashBalance> = {}): CashBalance => ({
  total_amount_cents: 100_000,
  cash_amount_cents: 50_000,
  card_amount_cents: 50_000,
  payment_count: 4,
  opening_time: "2026-08-02T08:00:00Z",
  pending_amount_cents: 0,
  pending_bookings_count: 0,
  ...overrides,
});

describe("buildDashboardPriorities", () => {
  it("returns an empty list when kpis are not loaded", () => {
    expect(
      buildDashboardPriorities({ kpis: null, balance: null, dirtyRoomsCount: null, featureFlags: null }),
    ).toEqual([]);
  });

  it("orders by severity high/medium/low with stable business order inside a severity", () => {
    const priorities = buildDashboardPriorities({
      kpis: kpis({ occupancy_rate: 50, arrivals_today: [{}] as DashboardKpis["arrivals_today"] }),
      balance: balance({ pending_amount_cents: 500 }),
      dirtyRoomsCount: 4,
      featureFlags: flags(),
    });
    const severities = priorities.map((priority) => priority.severity);
    expect(severities[0]).toBe("high");
    expect(severities[1]).toBe("high");
    expect(severities.slice(2)).toEqual(expect.arrayContaining(["medium", "medium", "medium", "medium"]));
    const medium = priorities.filter((priority) => priority.severity === "medium");
    expect(medium.map((priority) => priority.id)).toEqual([
      "arrival-readiness",
      "pricing-assistant-low-occ",
      "cash-pending",
    ]);
  });

  it("caps the list at six items", () => {
    const priorities = buildDashboardPriorities({
      kpis: kpis({ occupancy_rate: 50, arrivals_today: [{}] as DashboardKpis["arrivals_today"] }),
      balance: balance({ pending_amount_cents: 500 }),
      dirtyRoomsCount: 4,
      featureFlags: flags(),
    });
    expect(priorities.length).toBeLessThanOrEqual(MAX_PRIORITIES);
  });

  it("does not fabricate a dirty rooms priority when the count is unknown", () => {
    const priorities = buildDashboardPriorities({
      kpis: kpis({ occupancy_rate: 50 }),
      balance: null,
      dirtyRoomsCount: null,
      featureFlags: flags(),
    });
    expect(priorities.find((priority) => priority.id === "housekeeping-sla")).toBeUndefined();
  });

  it("skips automation priorities when the feature flag is disabled", () => {
    const priorities = buildDashboardPriorities({
      kpis: kpis({ occupancy_rate: 50 }),
      balance: null,
      dirtyRoomsCount: 5,
      featureFlags: flags({ automation_alerts_enabled: false }),
    });
    expect(priorities.find((priority) => priority.source === "automation")).toBeUndefined();
  });

  it("adds a cash priority only when there is a pending amount", () => {
    const withPending = buildDashboardPriorities({
      kpis: kpis(),
      balance: balance({ pending_amount_cents: 1 }),
      dirtyRoomsCount: null,
      featureFlags: flags(),
    });
    expect(withPending.find((priority) => priority.id === "cash-pending")).toBeDefined();
    const withoutPending = buildDashboardPriorities({
      kpis: kpis(),
      balance: balance({ pending_amount_cents: 0 }),
      dirtyRoomsCount: null,
      featureFlags: flags(),
    });
    expect(withoutPending.find((priority) => priority.id === "cash-pending")).toBeUndefined();
  });

  it("does not invent percentages or timestamps in descriptions", () => {
    const priorities = buildDashboardPriorities({
      kpis: kpis({ occupancy_rate: 50 }),
      balance: null,
      dirtyRoomsCount: null,
      featureFlags: flags(),
    });
    for (const priority of priorities) {
      expect(priority.description).not.toMatch(/[-+]?\d+%/);
      expect(priority.description).not.toMatch(/\d{1,2}:\d{2}/);
    }
  });

  it("maps destination routes to capabilities", () => {
    expect(getRouteCapability("/bookings")).toBe("bookings.read");
    expect(getRouteCapability("/calendar")).toBe("bookings.read");
    expect(getRouteCapability("/rooms")).toBe("rooms.read");
    expect(getRouteCapability("/housekeeping")).toBe("housekeeping.read");
    expect(getRouteCapability("/reports")).toBe("reports.revenue.read");
    expect(getRouteCapability(undefined)).toBeNull();
    expect(getRouteCapability("/forbidden")).toBeNull();
  });

  it("uses spanish visible labels for severity", () => {
    expect(SEVERITY_LABEL).toEqual({
      high: "Alta",
      medium: "Media",
      low: "Informativa",
    });
  });
});
