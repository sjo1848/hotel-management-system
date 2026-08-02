import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FrontDeskBoard } from "@/types/domain";
import FrontDeskBoardPanel from "./FrontDeskBoardPanel";

const entry = (overrides: Partial<FrontDeskBoard["arrivals_ready"][number]>) => ({
  booking_id: "booking-1",
  room_id: "room-1",
  room_number: "101",
  room_type: "Single",
  guest_name: "Ana Lista",
  check_in: "2026-03-01",
  check_out: "2026-03-03",
  booking_status: "Confirmed" as const,
  room_status: "Available" as const,
  total_price_cents: 20_000,
  operational_data: {},
  ...overrides,
});

const board: FrontDeskBoard = {
  date: "2026-03-01",
  arrivals_ready: [
    entry({ booking_id: "ready-1", guest_name: "Ana Lista", room_number: "101" }),
    entry({ booking_id: "ready-2", guest_name: "Carla Pronta", room_number: "102" }),
  ],
  arrivals_blocked: [
    entry({
      booking_id: "blocked-1",
      guest_name: "Blanca Bloqueo",
      room_number: "103",
      blocker: {
        kind: "hold",
        title: "Bloqueo de mantenimiento",
        detail: "Reparación de aire acondicionado en curso.",
      },
    }),
  ],
  departures_today: [
    entry({
      booking_id: "depart-1",
      guest_name: "Diego Salida",
      room_number: "104",
      booking_status: "CheckedIn",
    }),
  ],
  in_house: [
    entry({
      booking_id: "inhouse-1",
      guest_name: "Juan Juárez",
      room_number: "105",
      booking_status: "CheckedIn",
    }),
  ],
  holds_today: [
    {
      hold_id: "hold-1",
      room_id: "room-200",
      room_number: "200",
      room_type: "Suite",
      start_date: "2026-03-01",
      end_date: "2026-03-02",
      hold_type: "Maintenance",
      reason: "Pintura en curso.",
    },
  ],
  action_queue: [
    {
      entry: entry({ booking_id: "ready-1", guest_name: "Ana Lista", room_number: "101" }),
      lane: "Llegada",
      title: "Llegada lista",
      detail: "La habitación está disponible para completar la recepción.",
      primary_label: "Hacer check-in",
      action_kind: "prepare-check-in",
    },
  ],
};

const defaultProps = {
  board,
  loading: false,
  boardDate: "2026-03-01",
  onBoardDateChange: vi.fn(),
  onOpenBooking: vi.fn(),
  onPrepareCheckIn: vi.fn(),
};

describe("FrontDeskBoardPanel", () => {
  it("shows the full turn queue without truncation and with case counters", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    expect(screen.getByText(/Mostrando 5 de 5 casos del turno/i)).toBeDefined();
    expect(screen.getByText(/Caso 1 de 5/i)).toBeDefined();
    expect(screen.getByText(/Caso 5 de 5/i)).toBeDefined();
    expect(screen.getByText(/2 requieren atencion prioritaria/i)).toBeDefined();
  });

  it("does not duplicate a booking that is both in the action queue and a lane", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    const headings = screen.getAllByRole("heading", { name: /Ana Lista/i });
    expect(headings).toHaveLength(1);
  });

  it("uses the primary action per case lane", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    expect(screen.getAllByRole("button", { name: /Hacer check-in/i }).length).toBe(2);
    expect(screen.getByRole("button", { name: /Preparar checkout/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Revisar bloqueo/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Gestionar estadia/i })).toBeDefined();
  });

  it("dispatches prepare-check-in and open-booking with the queue context", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    const readyArticle = screen.getByText(/Ana Lista/i).closest("article");
    expect(readyArticle).not.toBeNull();
    fireEvent.click(
      within(readyArticle as HTMLElement).getByRole("button", { name: /Hacer check-in/i }),
    );
    expect(defaultProps.onPrepareCheckIn).toHaveBeenCalledWith(
      "ready-1",
      ["ready-1", "blocked-1", "depart-1", "ready-2", "inhouse-1"],
    );

    const inHouseArticle = screen.getByText(/Juan Juárez/i).closest("article");
    fireEvent.click(
      within(inHouseArticle as HTMLElement).getByRole("button", { name: /Gestionar estadia/i }),
    );
    expect(defaultProps.onOpenBooking).toHaveBeenCalledWith(
      "inhouse-1",
      ["ready-1", "blocked-1", "depart-1", "ready-2", "inhouse-1"],
    );
  });

  it("filters by lane and search normalizing accents", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /En casa/i }));
    expect(screen.getByText(/Mostrando 1 de 5 casos del turno/i)).toBeDefined();
    expect(screen.getByText(/Juan Juárez/i)).toBeDefined();
    expect(screen.queryByText(/Ana Lista/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Urgentes/i }));
    expect(screen.getByText(/Blanca Bloqueo/i)).toBeDefined();
    expect(screen.getByText(/Diego Salida/i)).toBeDefined();
    expect(screen.queryByText(/Carla Pronta/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Buscar en el turno/i), {
      target: { value: "juarez" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Todos/i }));
    expect(screen.getByText(/Juan Juárez/i)).toBeDefined();
    expect(screen.queryByText(/Ana Lista/i)).toBeNull();
  });

  it("shows the empty state when nothing matches the search", () => {
    render(<FrontDeskBoardPanel {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Buscar en el turno/i), {
      target: { value: "caso inexistente" },
    });
    expect(
      screen.getByText(/No hay casos que coincidan con la busqueda y el filtro actuales/i),
    ).toBeDefined();
  });

  it("shows the no-pending message for an empty board", () => {
    render(
      <FrontDeskBoardPanel
        {...defaultProps}
        board={{ ...board, arrivals_ready: [], arrivals_blocked: [], departures_today: [], in_house: [], holds_today: [], action_queue: [] }}
      />,
    );

    expect(
      screen.getByText(/No hay casos pendientes para la fecha operativa seleccionada/i),
    ).toBeDefined();
  });
});
