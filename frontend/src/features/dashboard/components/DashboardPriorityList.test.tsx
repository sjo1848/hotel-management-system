import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DashboardPriorityList from "./DashboardPriorityList";
import type { DashboardPriority } from "@/features/dashboard/utils/dashboardPriorities";

const priority = (overrides: Partial<DashboardPriority>): DashboardPriority => ({
  id: "p1",
  source: "operations",
  severity: "medium",
  title: "Título",
  description: "Descripción",
  actionLabel: "Revisar",
  route: "/bookings",
  ...overrides,
});

const priorities: DashboardPriority[] = [
  priority({ id: "high-1", severity: "high", title: "Alta uno", actionLabel: "Ajustar" }),
  priority({ id: "high-2", severity: "high", title: "Alta dos", actionLabel: "Tendencias" }),
  priority({ id: "medium-1", severity: "medium", title: "Media uno", actionLabel: "Ir" }),
  priority({ id: "low-1", severity: "low", title: "Info uno", actionLabel: "Revisar" }),
];

const renderList = (overrides: {
  priorities?: DashboardPriority[];
  loading?: boolean;
  hasCapability?: (route?: string) => boolean;
} = {}) => {
  const onAction = vi.fn();
  const onNavigateCalendar = vi.fn();
  const hasCapability = overrides.hasCapability ?? (() => true);
  render(
    <DashboardPriorityList
      priorities={overrides.priorities ?? priorities}
      loading={overrides.loading ?? false}
      hasCapability={hasCapability}
      onAction={onAction}
      onNavigateCalendar={onNavigateCalendar}
    />,
  );
  return { onAction, onNavigateCalendar, hasCapability };
};

describe("DashboardPriorityList", () => {
  it("renders priorities in the given stable order", () => {
    renderList();
    const titles = screen.getAllByRole("listitem").map((item) => within(item).getByText(/Alta uno|Alta dos|Media uno|Info uno/).textContent);
    expect(titles).toEqual(["Alta uno", "Alta dos", "Media uno", "Info uno"]);
  });

  it("shows spanish severity labels with icon text", () => {
    renderList();
    expect(screen.getAllByText("Alta", { exact: true })).toHaveLength(2);
    expect(screen.getByText("Media", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Informativa", { exact: true })).toBeInTheDocument();
  });

  it("renders exactly one action per row", () => {
    renderList();
    const rows = screen.getAllByRole("listitem");
    for (const row of rows) {
      expect(within(row).getAllByRole("button")).toHaveLength(1);
    }
  });

  it("hides the CTA when the destination capability is missing", () => {
    renderList({
      hasCapability: (route) => route !== "/bookings",
    });
    const rows = screen.getAllByRole("listitem");
    const withoutCta = rows.filter((row) => within(row).queryAllByRole("button").length === 0);
    expect(withoutCta.length).toBeGreaterThan(0);
  });

  it("shows the compact stable state when there are no priorities", () => {
    renderList({ priorities: [] });
    expect(screen.getByText("Operación estable")).toBeInTheDocument();
    expect(screen.getByText(/No hay alertas operativas/)).toBeInTheDocument();
  });

  it("keeps the stable state without a calendar CTA when capability is missing", () => {
    renderList({ priorities: [], hasCapability: () => false });
    expect(screen.getByText("Operación estable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver calendario/ })).not.toBeInTheDocument();
  });

  it("triggers navigation when a row CTA is activated", async () => {
    const user = userEvent.setup();
    const { onAction } = renderList();
    await user.click(screen.getByRole("button", { name: "Ir" }));
    expect(onAction).toHaveBeenCalledWith(priorities[2]);
  });

  it("shows skeletons while loading without rendering zeros", () => {
    renderList({ priorities: [], loading: true });
    expect(screen.queryByText("Operación estable")).not.toBeInTheDocument();
    expect(screen.queryByText(/crítica/)).not.toBeInTheDocument();
  });

  it("shows the critical counter only on mobile widths", () => {
    renderList();
    const counter = screen.getByText("2 críticas");
    expect(counter.className).toContain("md:hidden");
  });
});
