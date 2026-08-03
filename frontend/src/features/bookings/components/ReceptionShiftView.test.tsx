import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking, FrontDeskQueueItem } from "@/types/domain";
import { ReceptionShiftView } from "./ReceptionShiftView";

vi.mock("./BookingCaseWorkspace", () => ({
  default: ({ booking }: any) => <div data-testid="case-workspace">{booking.guest_name}</div>,
}));

const queueItem = (overrides: Partial<FrontDeskQueueItem>): FrontDeskQueueItem => ({
  entry: {
    booking_id: "booking-1",
    room_id: "room-1",
    room_number: "101",
    room_type: "Single",
    guest_name: "Juan Perez",
    check_in: "2026-03-01",
    check_out: "2026-03-03",
    booking_status: "Confirmed",
    room_status: "Available",
    total_price_cents: 20_000,
    operational_data: {},
  },
  lane: "Llegada",
  title: "Llegada lista",
  detail: "La habitación está disponible para completar la recepción.",
  primary_label: "Hacer check-in",
  action_kind: "open-booking",
  ...overrides,
});

const items: FrontDeskQueueItem[] = [
  queueItem({
    action_kind: "prepare-check-in",
    entry: { ...queueItem({}).entry, booking_id: "booking-1", guest_name: "Ana Lista" },
  }),
  queueItem({ entry: { ...queueItem({}).entry, booking_id: "booking-2", guest_name: "Carla Pronta" } }),
];

const booking: Booking = {
  id: "booking-1",
  hotel_id: "hotel-1",
  room_id: "room-1",
  guest_id: null,
  guest_name: "Ana Lista",
  check_in: "2026-03-01",
  check_out: "2026-03-03",
  total_price_cents: 20_000,
  status: "Confirmed",
  operational_data: {},
};

const defaultProps = {
  items,
  selectedBooking: null as Booking | null,
  loading: false,
  error: null as string | null,
  onRetry: vi.fn(),
  onOpenCase: vi.fn(),
  onPrepareCheckIn: vi.fn(),
  onCloseCase: vi.fn(),
  queueBookingIds: ["booking-1", "booking-2"],
  onOpenQueuedBooking: vi.fn(),
  guidedFocusStep: null,
};

describe("ReceptionShiftView", () => {
  it("shows the actionable empty state when no case is selected", () => {
    render(<ReceptionShiftView {...defaultProps} />);

    expect(screen.getByText(/foco del turno/i)).toBeDefined();
    expect(screen.getByText(/2 caso\(s\) esperando atención/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /abrir primer caso/i }));
    expect(defaultProps.onOpenCase).toHaveBeenCalledWith("booking-1");
    expect(screen.queryByTestId("case-workspace")).toBeNull();
  });

  it("renders the queue and the selected case in the detail panel", () => {
    render(<ReceptionShiftView {...defaultProps} selectedBooking={booking} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByRole("option", { name: /Ana Lista/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("case-workspace")).toHaveTextContent("Ana Lista");
  });

  it("opens the case from the queue and dispatches the check-in preparation", () => {
    render(<ReceptionShiftView {...defaultProps} />);

    fireEvent.click(screen.getByRole("option", { name: /Carla Pronta/i }));
    expect(defaultProps.onOpenCase).toHaveBeenCalledWith("booking-2");

    fireEvent.click(screen.getByRole("button", { name: /hacer check-in/i }));
    expect(defaultProps.onPrepareCheckIn).toHaveBeenCalledWith("booking-1");
  });

  it("shows the summary line with the number of cases", () => {
    render(<ReceptionShiftView {...defaultProps} />);

    expect(screen.getByText(/Mostrando 2 casos del turno/i)).toBeDefined();
  });

  it("filters the queue by search without removing the source cases", () => {
    render(<ReceptionShiftView {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Buscar en el turno/i), {
      target: { value: "Carla" },
    });

    expect(screen.getByRole("option", { name: /Carla Pronta/i })).toBeDefined();
    expect(screen.queryByRole("option", { name: /Ana Lista/i })).toBeNull();
    expect(screen.getByText(/Mostrando 1 casos del turno/i)).toBeDefined();
  });

  it("shows the no-match state when the search has no results", () => {
    render(<ReceptionShiftView {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Buscar en el turno/i), {
      target: { value: "caso inexistente zzz" },
    });

    expect(
      screen.getByText(/No hay casos que coincidan con la busqueda y el filtro actuales/i),
    ).toBeDefined();
  });
});
