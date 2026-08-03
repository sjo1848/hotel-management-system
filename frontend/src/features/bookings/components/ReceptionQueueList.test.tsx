import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildCockpitQueue,
  buildLaneIdSets,
  filterCockpitQueue,
} from "@/features/bookings/utils/cockpitQueue";
import type { FrontDeskBoardEntry } from "@/types/domain";
import { ReceptionQueueList } from "./ReceptionQueueList";

const entry = (overrides: Partial<FrontDeskBoardEntry>) => ({
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

const input = {
  actionQueue: [
    {
      entry: entry({ booking_id: "ready-1", guest_name: "Ana Lista" }),
      lane: "Llegada",
      title: "Llegada lista",
      detail: "La habitación está disponible para completar la recepción.",
      primary_label: "Hacer check-in",
      action_kind: "prepare-check-in" as const,
    },
  ],
  readyArrivals: [
    entry({ booking_id: "ready-1", guest_name: "Ana Lista" }),
    entry({ booking_id: "ready-2", guest_name: "Carla Pronta" }),
  ],
  blockedArrivals: [
    entry({
      booking_id: "blocked-1",
      guest_name: "Blanca Bloqueo",
      blocker: {
        kind: "hold",
        title: "Bloqueo de mantenimiento",
        detail: "Reparación de aire acondicionado en curso.",
      },
    }),
  ],
  departures: [entry({ booking_id: "depart-1", guest_name: "Diego Salida", room_number: "104" })],
  inHouse: [entry({ booking_id: "inhouse-1", guest_name: "Juan Juárez" })],
};

const queue = buildCockpitQueue(input);
const laneIds = buildLaneIdSets(
  input.readyArrivals,
  input.blockedArrivals,
  input.departures,
  input.inHouse,
);
const filterBy = (filter: "all" | "arrivals" | "in-house" | "departures", searchQuery = "") =>
  filterCockpitQueue({ queue, searchQuery, queueFilter: filter, laneIds });

const defaultProps = {
  loading: false,
  error: null as string | null,
  emptyMessage: "No hay casos pendientes",
  onRetry: vi.fn(),
  onOpen: vi.fn(),
  onPrepareCheckIn: vi.fn(),
  ariaLabel: "Cola del turno",
};

const listbox = () => screen.getByRole("listbox", { name: /cola del turno/i });
const optionByName = (name: string) => within(listbox()).getByRole("option", { name: new RegExp(name, "i") });

describe("ReceptionQueueList", () => {
  it("renders compact rows in the given lane order without duplicates", () => {
    render(<ReceptionQueueList {...defaultProps} items={filterBy("all")} />);

    const options = within(listbox()).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining("Ana Lista"),
      expect.stringContaining("Blanca Bloqueo"),
      expect.stringContaining("Diego Salida"),
      expect.stringContaining("Carla Pronta"),
      expect.stringContaining("Juan Juárez"),
    ]);
    expect(screen.getAllByText(/Ana Lista/i)).toHaveLength(1);
  });

  it("shows a single primary action: button only for check-in ready cases", () => {
    render(<ReceptionQueueList {...defaultProps} items={filterBy("all")} />);

    expect(screen.getAllByRole("button", { name: /hacer check-in/i })).toHaveLength(2);
    const readyRow = optionByName("Ana Lista");
    expect(within(readyRow).getByRole("button", { name: /hacer check-in/i })).toBeDefined();
    const blockedRow = optionByName("Blanca Bloqueo");
    expect(within(blockedRow).queryByRole("button")).toBeNull();
    expect(within(blockedRow).getByText(/revisar/i)).toBeDefined();
  });

  it("shows the filtered result after an accent-insensitive search", () => {
    render(<ReceptionQueueList {...defaultProps} items={filterBy("all", "juarez")} />);

    const options = within(listbox()).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Juan Juárez");
  });

  it("shows the empty message per view", () => {
    render(<ReceptionQueueList {...defaultProps} items={filterBy("in-house", "sin resultados")} />);

    expect(screen.getByText("No hay casos pendientes")).toBeDefined();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("renders skeleton rows while loading without switching layout", () => {
    const { rerender } = render(<ReceptionQueueList {...defaultProps} items={[]} loading />);

    const status = screen.getByRole("status", { name: /cargando cola del turno/i });
    expect(status).toBeDefined();

    rerender(<ReceptionQueueList {...defaultProps} items={filterBy("all")} loading={false} />);
    expect(screen.getByRole("listbox", { name: /cola del turno/i })).toBeDefined();
  });

  it("shows the error state and retries", () => {
    const onRetry = vi.fn();
    render(
      <ReceptionQueueList
        {...defaultProps}
        items={[]}
        error="La conexión falló."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/no se pudo cargar la cola/i)).toBeDefined();
    expect(screen.getByText(/la conexión falló/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("opens the case on row click and on Enter", () => {
    const onOpen = vi.fn();
    render(<ReceptionQueueList {...defaultProps} items={filterBy("arrivals")} onOpen={onOpen} />);

    fireEvent.click(optionByName("Carla Pronta"));
    expect(onOpen).toHaveBeenCalledWith("ready-2");

    const blockedRow = optionByName("Blanca Bloqueo");
    fireEvent.keyDown(blockedRow, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith("blocked-1");
  });

  it("moves focus between rows with arrow keys without opening", () => {
    const onOpen = vi.fn();
    render(<ReceptionQueueList {...defaultProps} items={filterBy("all")} onOpen={onOpen} />);

    const firstRow = optionByName("Ana Lista");
    firstRow.focus();
    fireEvent.keyDown(listbox(), { key: "ArrowDown" });
    expect(optionByName("Blanca Bloqueo")).toHaveFocus();
    fireEvent.keyDown(listbox(), { key: "ArrowUp" });
    expect(firstRow).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("marks the selected booking as aria-selected", () => {
    render(
      <ReceptionQueueList
        {...defaultProps}
        items={filterBy("all")}
        selectedBookingId="blocked-1"
      />,
    );

    expect(optionByName("Blanca Bloqueo")).toHaveAttribute("aria-selected", "true");
    expect(optionByName("Ana Lista")).toHaveAttribute("aria-selected", "false");
  });
});
