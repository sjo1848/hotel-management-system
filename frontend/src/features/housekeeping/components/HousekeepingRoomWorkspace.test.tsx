import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HousekeepingRoomWorkspace from "./HousekeepingRoomWorkspace";
import type { HousekeepingQueueItem } from "../housekeepingQueue";

const item = (status: "Dirty" | "Cleaning" | "Available" | "Maintenance"): HousekeepingQueueItem => ({ room_id: "r1", room_number: "101", room_type: "DOUBLE", room_status: status, turnover_today: true, priorityRank: 1, isBlocked: false, isOrphanDeparture: false });

describe("HousekeepingRoomWorkspace", () => {
  it("offers only the start action for Dirty", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<HousekeepingRoomWorkspace item={item("Dirty")} canWrite loadingAction={null} onStart={onStart} onFinish={vi.fn()} onOpenMaintenance={vi.fn()} onResolveMaintenance={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Acción" }));
    await user.click(screen.getByRole("button", { name: "Iniciar limpieza" }));
    expect(onStart).toHaveBeenCalledWith("r1");
    expect(screen.queryByRole("button", { name: "Finalizar limpieza" })).not.toBeInTheDocument();
  });

  it("offers only finish for Cleaning and no-op message for Available", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const { rerender } = render(<HousekeepingRoomWorkspace item={item("Cleaning")} canWrite loadingAction={null} onStart={vi.fn()} onFinish={onFinish} onOpenMaintenance={vi.fn()} onResolveMaintenance={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Acción" }));
    await user.click(screen.getByRole("button", { name: "Finalizar limpieza" }));
    expect(onFinish).toHaveBeenCalledWith("r1");
    rerender(<HousekeepingRoomWorkspace item={item("Available")} canWrite loadingAction={null} onStart={vi.fn()} onFinish={vi.fn()} onOpenMaintenance={vi.fn()} onResolveMaintenance={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/No hay transición operativa/)).toBeInTheDocument();
  });

  it("associates the active panel and supports roving keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<HousekeepingRoomWorkspace item={item("Dirty")} canWrite loadingAction={null} onStart={vi.fn()} onFinish={vi.fn()} onOpenMaintenance={vi.fn()} onResolveMaintenance={vi.fn()} onClose={vi.fn()} />);
    const summary = screen.getByRole("tab", { name: "Resumen" });
    const action = screen.getByRole("tab", { name: "Acción" });
    summary.focus();
    await user.keyboard("{ArrowRight}");
    expect(action).toHaveFocus();
    expect(action).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", action.id);
  });
});
