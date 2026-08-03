import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ReceptionWorkspaceTabs,
  workspaceViews,
  type ReceptionWorkspaceView,
} from "./ReceptionWorkspaceTabs";

const counts: Record<ReceptionWorkspaceView, number> = {
  shift: 5,
  arrivals: 3,
  "in-house": 2,
  departures: 1,
  reservations: 12,
};

const Harness = ({ onViewChange }: { onViewChange: (view: ReceptionWorkspaceView) => void }) => {
  const [view, setView] = useState<ReceptionWorkspaceView>("shift");
  return (
    <ReceptionWorkspaceTabs
      activeView={view}
      counts={counts}
      onViewChange={(next) => {
        setView(next);
        onViewChange(next);
      }}
    />
  );
};

const tablist = () => screen.getByRole("tablist", { name: /vistas de recepción/i });

describe("ReceptionWorkspaceTabs", () => {
  it("renders the five workspace views with compact counters", () => {
    render(<Harness onViewChange={vi.fn()} />);

    const tabs = within(tablist()).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+/g, "").trim())).toEqual([
      "Turno",
      "Llegadas",
      "En casa",
      "Salidas",
      "Reservas",
    ]);
    expect(screen.getByRole("tab", { name: /Turno 5/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Llegadas 3/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /En casa 2/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Salidas 1/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /Reservas 12/i })).toBeDefined();
  });

  it("selects Turno by default with correct aria-selected and tab order", () => {
    render(<Harness onViewChange={vi.fn()} />);

    const tabs = within(tablist()).getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    for (const tab of tabs.slice(1)) {
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab).toHaveAttribute("tabindex", "-1");
    }
  });

  it("changes view on click and fires the callback once per interaction", () => {
    const onViewChange = vi.fn();
    render(<Harness onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /Reservas 12/i }));
    expect(screen.getByRole("tab", { name: /Reservas 12/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(onViewChange).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledWith("reservations");
  });

  it("moves selection and focus with arrow keys", () => {
    const onViewChange = vi.fn();
    render(<Harness onViewChange={onViewChange} />);

    const turnoTab = screen.getByRole("tab", { name: /Turno 5/i });
    fireEvent.keyDown(turnoTab, { key: "ArrowRight" });
    expect(onViewChange).toHaveBeenCalledWith("arrivals");
    const arrivalsTab = screen.getByRole("tab", { name: /Llegadas 3/i });
    expect(arrivalsTab).toHaveAttribute("aria-selected", "true");
    expect(arrivalsTab).toHaveFocus();

    fireEvent.keyDown(arrivalsTab, { key: "ArrowLeft" });
    expect(onViewChange).toHaveBeenCalledWith("shift");
    expect(screen.getByRole("tab", { name: /Turno 5/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("wraps around when navigating past the last or first tab", () => {
    const onViewChange = vi.fn();
    render(<Harness onViewChange={onViewChange} />);

    const reservasTab = screen.getByRole("tab", { name: /Reservas 12/i });
    fireEvent.keyDown(reservasTab, { key: "ArrowRight" });
    expect(onViewChange).toHaveBeenCalledWith("shift");
  });

  it("exposes the five view ids in order", () => {
    expect(workspaceViews.map((view) => view.id)).toEqual([
      "shift",
      "arrivals",
      "in-house",
      "departures",
      "reservations",
    ]);
  });
});
