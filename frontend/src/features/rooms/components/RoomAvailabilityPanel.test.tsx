import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/types/domain";
import { RoomAvailabilityPanel, type RoomAvailabilityPanelProps } from "./RoomAvailabilityPanel";
import AvailabilityPicker from "./AvailabilityPicker";

const makeRoom = (id: string): Room => ({
  id,
  hotel_id: "h",
  room_number: id,
  room_type: "DOUBLE",
  status: "Available",
  price_cents: 250000,
});

const dates = { from: "2026-08-10", to: "2026-08-12" };

const renderPanel = (overrides: Partial<RoomAvailabilityPanelProps> = {}) => {
  const props: RoomAvailabilityPanelProps = {
    dates: null,
    isLoading: false,
    error: null,
    availableRooms: [],
    canCreateBooking: true,
    onSearch: vi.fn(),
    onClear: vi.fn(),
    onRetry: vi.fn(),
    onReserve: vi.fn(),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<RoomAvailabilityPanel {...props} />) };
};

describe("RoomAvailabilityPanel", () => {
  it("shows the instructive state before searching", () => {
    renderPanel();
    expect(
      screen.getByText(/Elegí un rango de fechas y presioná Buscar/),
    ).toBeInTheDocument();
  });

  it("shows range and nights once dates are set", () => {
    renderPanel({ dates, availableRooms: [makeRoom("101")] });

    expect(
      screen.getByText(/Disponibilidad del 2026-08-10 al 2026-08-12/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 habitaciones encontradas · 2 noches/)).toBeInTheDocument();
  });

  it("keeps the search button disabled with an incomplete range", () => {
    render(<AvailabilityPicker onSearch={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Buscar Habitaciones/i })).toBeDisabled();
    expect(screen.getByText("Seleccionar entrada y salida")).toBeInTheDocument();
  });

  it("does not trigger a search while selecting the range", async () => {
    const onSearch = vi.fn();
    render(<AvailabilityPicker onSearch={onSearch} onClear={vi.fn()} />);

    expect(onSearch).not.toHaveBeenCalled();
    expect(
      screen.getByText("Seleccioná entrada y salida para ver disponibilidad."),
    ).toBeInTheDocument();
  });

  it("shows loading skeletons instead of stale results", () => {
    const { container } = renderPanel({ dates, isLoading: true });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows the empty state with an action to change dates", async () => {
    const { props } = renderPanel({ dates });

    expect(
      screen.getByText("No hay habitaciones disponibles para este rango"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cambiar fechas" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("shows the error locally and retries with the same dates", async () => {
    const { props } = renderPanel({ dates, error: "Fallo de red al buscar" });

    expect(
      screen.getByText("No se pudo cargar la disponibilidad"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fallo de red al buscar")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it("reserves from a result without touching inventory state", async () => {
    const { props } = renderPanel({ dates, availableRooms: [makeRoom("101")] });

    await userEvent.click(screen.getByRole("button", { name: "Reservar" }));
    expect(props.onReserve).toHaveBeenCalledWith(makeRoom("101"));
    expect(screen.queryByText(/seleccionadas/)).not.toBeInTheDocument();
  });

  it("hides reserve CTAs without bookings.write", () => {
    renderPanel({ dates, availableRooms: [makeRoom("101")], canCreateBooking: false });
    expect(screen.queryByRole("button", { name: "Reservar" })).not.toBeInTheDocument();
  });

  it("clears without altering the inventory", async () => {
    const { props } = renderPanel({ dates, availableRooms: [makeRoom("101")] });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Limpiar" })[1],
    );
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
