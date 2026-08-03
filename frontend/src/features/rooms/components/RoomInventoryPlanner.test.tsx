import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";
import RoomInventoryPlanner from "./RoomInventoryPlanner";

const START_DATE = "2026-08-02";

const makeRoom = (id: string, room_number: string, overrides: Partial<Room> = {}): Room => ({
  id,
  hotel_id: "hotel-1",
  room_number,
  room_type: "DOUBLE",
  status: "Available",
  price_cents: 250000,
  ...overrides,
});

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

const makeBooking = (overrides: Partial<Booking>): Booking => ({
  id: "booking-1",
  hotel_id: "hotel-1",
  room_id: "room-1",
  guest_id: "guest-1",
  guest_name: "Ana Pérez",
  check_in: "2026-08-03",
  check_out: "2026-08-05",
  total_price_cents: 500000,
  status: "Confirmed",
  operational_data: {},
  ...overrides,
});

const renderPlanner = ({
  rooms = [makeRoom("room-1", "101")],
  holds = [],
  bookings = [],
  startDate = START_DATE,
  onManageRoom = vi.fn(),
}: {
  rooms?: Room[];
  holds?: RoomHoldBoardEntry[];
  bookings?: Booking[];
  startDate?: string;
  onManageRoom?: (roomId: string) => void;
} = {}) => ({
  onManageRoom,
  ...render(
    <RoomInventoryPlanner
      rooms={rooms}
      holds={holds}
      bookings={bookings}
      startDate={startDate}
      onManageRoom={onManageRoom}
    />,
  ),
});

describe("RoomInventoryPlanner", () => {
  it("shows seven consecutive days in the visible window", () => {
    renderPlanner();

    expect(screen.getByText(/Ventana visible/)).toBeInTheDocument();
    expect(screen.getByText(/02 ago al 08 ago/)).toBeInTheDocument();
    ["02", "03", "04", "05", "06", "07", "08"].forEach((day) => {
      expect(screen.getAllByText(day).length).toBeGreaterThan(0);
    });
  });

  it("orders rows by room number without inferring floors", () => {
    renderPlanner({
      rooms: [
        makeRoom("room-102", "102"),
        makeRoom("room-101", "101"),
        makeRoom("room-1003", "1003"),
      ],
    });

    const visibleNumbers = screen
      .getAllByText(/^\d{3,4}$/)
      .map((node) => node.textContent);
    expect(visibleNumbers.slice(0, 3)).toEqual(["101", "102", "1003"]);
  });

  it("shows an active booking on its nights and counts occupancy", () => {
    renderPlanner({
      bookings: [
        makeBooking({
          check_in: "2026-08-03",
          check_out: "2026-08-05",
          status: "Confirmed",
        }),
      ],
    });

    expect(screen.getAllByText("Reserva").length).toBe(2);
    expect(screen.getByText(/1 habitaciones con ocupación futura visible/)).toBeInTheDocument();
    expect(screen.getByText(/0 estancias activas en la ventana/)).toBeInTheDocument();
  });

  it("distinguishes an active stay from a projected booking", () => {
    renderPlanner({
      bookings: [
        makeBooking({
          check_in: "2026-08-02",
          check_out: "2026-08-04",
          status: "CheckedIn",
        }),
      ],
    });

    expect(screen.getAllByText("Hospedado").length).toBe(3);
    expect(screen.getByText(/1 estancias activas en la ventana/)).toBeInTheDocument();
  });

  it("shows active holds without hiding booking info in the same cell", () => {
    renderPlanner({
      holds: [
        makeHold({
          start_date: "2026-08-04",
          end_date: "2026-08-06",
          hold_type: "Maintenance",
        }),
      ],
      bookings: [
        makeBooking({
          check_in: "2026-08-04",
          check_out: "2026-08-05",
          status: "Confirmed",
        }),
      ],
    });

    expect(screen.getAllByText("Mantenimiento").length).toBe(2);
    expect(screen.getAllByText("Reserva").length).toBe(1);
    expect(screen.getByText(/1 bloqueo\(s\) en la ventana visible/)).toBeInTheDocument();
  });

  it("keeps the room row usable when holds data is partial or missing", () => {
    renderPlanner({
      rooms: [makeRoom("room-1", "101"), makeRoom("room-2", "102")],
    });

    expect(screen.getAllByText(/^101$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^102$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sin bloqueos ni reservas visibles en esta semana/).length).toBe(2);
  });

  it("switches the selected day from the mobile day selector", async () => {
    const user = userEvent.setup();
    renderPlanner();

    const nextDay = screen.getByRole("button", { name: "Día siguiente" });
    const initialPressed = screen.getAllByRole("button", { pressed: true });
    expect(initialPressed.length).toBe(1);
    expect(initialPressed[0]).toHaveTextContent("dom 02");

    await user.click(nextDay);

    const pressedAfter = screen.getAllByRole("button", { pressed: true });
    expect(pressedAfter.length).toBe(1);
    expect(pressedAfter[0]).toHaveTextContent("lun 03");
  });

  it("never renders floor groupings from room numbers", () => {
    renderPlanner({
      rooms: [
        makeRoom("room-1", "101"),
        makeRoom("room-2", "201"),
        makeRoom("room-3", "301"),
      ],
    });

    expect(screen.queryByText(/Piso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Planta/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^101$/).length).toBeGreaterThan(0);
  });
});
