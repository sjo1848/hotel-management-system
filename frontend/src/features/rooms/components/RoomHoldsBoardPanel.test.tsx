import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomHoldBoardEntry } from "@/types/domain";
import RoomHoldsBoardPanel from "./RoomHoldsBoardPanel";

const makeHold = (overrides: Partial<RoomHoldBoardEntry>): RoomHoldBoardEntry => ({
  hold_id: "hold-1",
  room_id: "room-1",
  room_number: "101",
  room_type: "DOUBLE",
  start_date: "2026-08-02",
  end_date: "2026-08-05",
  hold_type: "Maintenance",
  reason: "Cambio de aire acondicionado",
  ...overrides,
});

const renderBoard = ({
  holds = [],
  loading = false,
  startDate = "2026-07-20",
  endDate = "2026-08-19",
  onStartDateChange = vi.fn(),
  onEndDateChange = vi.fn(),
  onManageRoom = vi.fn(),
}: {
  holds?: RoomHoldBoardEntry[];
  loading?: boolean;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  onManageRoom?: (roomId: string) => void;
} = {}) => ({
  onStartDateChange,
  onEndDateChange,
  onManageRoom,
  ...render(
    <RoomHoldsBoardPanel
      holds={holds}
      loading={loading}
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={onStartDateChange}
      onEndDateChange={onEndDateChange}
      onManageRoom={onManageRoom}
    />,
  ),
});

describe("RoomHoldsBoardPanel", () => {
  it("defaults to a 30 day window and renders the timeline", () => {
    renderBoard({ holds: [makeHold({})] });

    expect(screen.getByText("Timeline de bloqueos")).toBeInTheDocument();
    expect(screen.getByText("Habitación / timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-08-19");
  });

  it("rejects a range where end is before start", () => {
    renderBoard({ startDate: "2026-08-10", endDate: "2026-08-05" });

    expect(
      screen.getByText("La fecha hasta debe ser posterior a la de desde."),
    ).toBeInTheDocument();
  });

  it("rejects a range wider than 31 days", () => {
    renderBoard({ startDate: "2026-07-01", endDate: "2026-08-19" });

    expect(screen.getByText("El rango máximo es de 31 días.")).toBeInTheDocument();
  });

  it("filters holds by type", async () => {
    const user = userEvent.setup();
    renderBoard({
      holds: [
        makeHold({ hold_type: "Maintenance" }),
        makeHold({ hold_id: "hold-2", room_number: "102", hold_type: "Owner" }),
      ],
    });

    expect(screen.getByText("Mantenimiento: 1 activas")).toBeInTheDocument();
    expect(screen.getByText("Owner: 1 activas")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Tipo de bloqueo"), "Owner");

    expect(screen.queryByText("Mantenimiento: 1 activas")).not.toBeInTheDocument();
    expect(screen.getByText("Owner: 1 activas")).toBeInTheDocument();
  });

  it("filters holds by room number", async () => {
    const user = userEvent.setup();
    renderBoard({
      holds: [
        makeHold({ room_number: "101" }),
        makeHold({ hold_id: "hold-2", room_number: "102", hold_type: "Owner" }),
      ],
    });

    await user.type(screen.getByLabelText("Buscar habitación"), "102");

    expect(screen.queryAllByText(/Habitación 101/)).toHaveLength(0);
    expect(screen.getAllByText(/Habitación 102/).length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no holds", () => {
    renderBoard();

    expect(
      screen.getByText("No hay habitaciones fuera de venta por bloqueos en este rango."),
    ).toBeInTheDocument();
  });

  it("renders a loading state without data", () => {
    renderBoard({ loading: true, holds: [makeHold({})] });

    expect(screen.getByText("Cargando bloqueos del rango...")).toBeInTheDocument();
  });

  it("marks the day a hold covers in the desktop timeline", () => {
    renderBoard({
      holds: [
        makeHold({
          start_date: "2026-08-02",
          end_date: "2026-08-05",
          hold_type: "Maintenance",
        }),
      ],
    });

    const timelineChips = screen.getAllByTitle(/Cambio de aire acondicionado/);
    expect(timelineChips.length).toBe(3);
  });

  it("surfaces each hold as an actionable card", async () => {
    const user = userEvent.setup();
    const { onManageRoom } = renderBoard({
      holds: [
        makeHold({
          start_date: "2026-08-02",
          end_date: "2026-08-05",
          reason: "Cambio de aire acondicionado",
        }),
      ],
    });

    expect(screen.getAllByText(/Habitación 101/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cambio de aire acondicionado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Gestionar habitación" }));
    expect(onManageRoom).toHaveBeenCalledWith("room-1");
  });

  it("exposes management as navigation without local creation actions", async () => {
    const user = userEvent.setup();
    const { onManageRoom } = renderBoard({
      holds: [makeHold({})],
    });

    expect(screen.queryByRole("button", { name: /crear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo/i })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Gestionar" })[0]);
    expect(onManageRoom).toHaveBeenCalledWith("room-1");
  });
});
