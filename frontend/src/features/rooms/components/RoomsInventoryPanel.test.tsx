import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/types/domain";
import {
  RoomsInventoryPanel,
  type RoomsInventoryPanelProps,
} from "./RoomsInventoryPanel";

const makeRoom = (id: string, status: Room["status"]): Room => ({
  id,
  hotel_id: "h",
  room_number: id,
  room_type: id === "104" ? "SUITE" : "DOUBLE",
  status,
  price_cents: 250000,
});

const rooms: Room[] = [
  makeRoom("101", "Available"),
  makeRoom("102", "Occupied"),
  makeRoom("103", "Dirty"),
  makeRoom("104", "Maintenance"),
];

const renderPanel = (overrides: Partial<RoomsInventoryPanelProps> = {}) => {
  const props: RoomsInventoryPanelProps = {
    rooms,
    isLoading: false,
    error: null,
    searchQuery: "",
    onSearchChange: vi.fn(),
    statusFilter: "all",
    onStatusFilterChange: vi.fn(),
    viewMode: "grid",
    onViewModeChange: vi.fn(),
    selectedRoomIds: [],
    onToggleSelection: vi.fn(),
    canManageStatus: true,
    canManageInventory: true,
    canCreateBooking: true,
    onReserve: vi.fn(),
    onViewDetails: vi.fn(),
    onChangeStatus: vi.fn(),
    onRefresh: vi.fn(),
    onCreateRoom: vi.fn(),
    bulkBusy: null,
    onApplyBulk: vi.fn(),
    onClearSelection: vi.fn(),
    ...overrides,
  };
  return { props, user: userEvent.setup(), ...render(<RoomsInventoryPanel {...props} />) };
};

describe("RoomsInventoryPanel", () => {
  it("finds a room by number", () => {
    renderPanel({ searchQuery: "102" });

    expect(screen.getByText("1 resultados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver detalle de habitación 102" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver detalle de habitación 101" }),
    ).not.toBeInTheDocument();
  });

  it("finds a room by type", () => {
    renderPanel({ searchQuery: "suite" });

    expect(screen.getByText("1 resultados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver detalle de habitación 104" }),
    ).toBeInTheDocument();
  });

  it("matches visible Spanish status keywords like limpieza", () => {
    renderPanel({ searchQuery: "limpieza" });

    expect(screen.getByText("1 resultados")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver detalle de habitación 103" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver detalle de habitación 101" }),
    ).not.toBeInTheDocument();
  });

  it("notifies the search query on typing", () => {
    const { props } = renderPanel();
    const input = screen.getByRole("searchbox", { name: "Buscar en el inventario" });

    fireEvent.change(input, { target: { value: "101" } });

    expect(props.onSearchChange).toHaveBeenCalledWith("101");
  });

  it("renders status chips with counts over the full inventory", () => {
    renderPanel();

    const todash = screen.getByRole("button", { name: "Todas 4" });
    expect(todash).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Disponibles 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocupadas 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpieza 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mantenimiento 1" })).toBeInTheDocument();
  });

  it("filters the grid by status chip without leaving the view", async () => {
    const { props } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Ocupadas 1" }));
    expect(props.onStatusFilterChange).toHaveBeenCalledWith("occupied");
  });

  it("switches between Compacta and Tabla views", async () => {
    const { props } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Tabla" }));
    expect(props.onViewModeChange).toHaveBeenCalledWith("list");

    await userEvent.click(screen.getByRole("button", { name: "Compacta" }));
    expect(props.onViewModeChange).toHaveBeenCalledWith("grid");
  });

  it("keeps row detail separate from bulk selection in table mode", async () => {
    const { props } = renderPanel({ viewMode: "list" });

    await userEvent.click(screen.getByText("Habitación 101"));
    expect(props.onViewDetails).toHaveBeenCalledWith(rooms[0]);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar habitación 101" }),
    );
    expect(props.onToggleSelection).toHaveBeenCalledWith("101");
    expect(props.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it("opens detail from a grid card but not from its checkbox", async () => {
    const { props } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Ver detalle de habitación 101/ }));
    expect(props.onViewDetails).toHaveBeenCalledWith(rooms[0]);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar habitación 102" }),
    );
    expect(props.onToggleSelection).toHaveBeenCalledWith("102");
    expect(props.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it("shows an indeterminate header checkbox with partial selection", async () => {
    renderPanel({
      viewMode: "list",
      selectedRoomIds: ["101"],
    });

    const headerCheckbox = screen.getByRole("checkbox", {
      name: "Seleccionar habitaciones visibles",
    }) as HTMLInputElement;
    expect(headerCheckbox.indeterminate).toBe(true);
  });

  it("reports out-of-filter selection and selects visible rooms on demand", async () => {
    const { props } = renderPanel({
      viewMode: "list",
      selectedRoomIds: ["101"],
      statusFilter: "occupied",
    });

    expect(screen.getByText("1 fuera del filtro")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Seleccionar visibles (1)" }));
    expect(props.onToggleSelection).toHaveBeenCalledWith("102");
  });

  it("drops ghost ids of rooms that disappeared after a refetch", () => {
    renderPanel({
      selectedRoomIds: ["101", "999"],
    });

    expect(screen.getByText("1 habitaciones seleccionadas")).toBeInTheDocument();
    expect(screen.queryByText("2 habitaciones seleccionadas")).not.toBeInTheDocument();
  });

  it("shows a single compact alert for maintenance rooms", () => {
    renderPanel();
    expect(
      screen.getByText("1 habitación en mantenimiento. Se resuelven desde Housekeeping."),
    ).toBeInTheDocument();
  });

  it("shows the no-available alert when every room is sold", () => {
    const allBusy = [makeRoom("101", "Occupied"), makeRoom("102", "Dirty")];
    renderPanel({ rooms: allBusy });
    expect(
      screen.getByText("No hay habitaciones disponibles en este momento."),
    ).toBeInTheDocument();
  });

  it("clears search with Escape when the input has focus", async () => {
    const { props } = renderPanel();
    const input = screen.getByRole("searchbox", { name: "Buscar en el inventario" });

    await userEvent.type(input, "101");
    await userEvent.keyboard("{Escape}");

    expect(props.onSearchChange).toHaveBeenLastCalledWith("");
  });

  it("shows the local error panel with retry in grid mode", async () => {
    const { props } = renderPanel({ error: "Fallo de red al cargar habitaciones" });

    expect(
      screen.getByText("No se pudo cargar el inventario"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fallo de red al cargar habitaciones"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the bulk bar isolated from the availability results", () => {
    renderPanel({ selectedRoomIds: ["101", "103"] });

    const bar = screen.getByText("Acción masiva").closest("section");
    expect(bar).not.toBeNull();
    expect(within(bar!).getByText("2 habitaciones seleccionadas")).toBeInTheDocument();
  });
});
