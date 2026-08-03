import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RoomsPage from "./RoomsPage";
import { HMSQueryProvider } from "@/lib/QueryProvider";
import { queryClient } from "@/lib/queryClient";
import type { Room } from "@/types/domain";

const mockListRooms = vi.fn();
const mockSearchAvailableRooms = vi.fn();
const mockGetRoomHoldBoard = vi.fn();
const mockGetBookings = vi.fn();
const mockGetRoomById = vi.fn();
const mockUpdateRoomStatus = vi.fn();
const mockBulkUpdateRoomStatus = vi.fn();
const mockToast = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

vi.mock("./services/roomService", () => ({
  listRooms: (...args: unknown[]) => mockListRooms(...args),
  searchAvailableRooms: (...args: unknown[]) => mockSearchAvailableRooms(...args),
  getRoomHoldBoard: (...args: unknown[]) => mockGetRoomHoldBoard(...args),
  getRoomById: (...args: unknown[]) => mockGetRoomById(...args),
  updateRoomStatus: (...args: unknown[]) => mockUpdateRoomStatus(...args),
  bulkUpdateRoomStatus: (...args: unknown[]) => mockBulkUpdateRoomStatus(...args),
  getAllRooms: vi.fn(),
}));

vi.mock("@/features/bookings/services/bookingService", () => ({
  getBookings: (...args: unknown[]) => mockGetBookings(...args),
}));

vi.mock("@/features/bookings/components/BookingDrawer", () => ({
  default: () => <div data-testid="booking-drawer" />,
}));

vi.mock("./components/RoomCreateDrawer", () => ({
  default: () => <div data-testid="room-create-drawer" />,
}));

vi.mock("./components/RoomAdminSheet", () => ({
  default: () => <div data-testid="room-admin-sheet" />,
}));

const makeRoom = (overrides: Partial<Room>): Room => ({
  id: "r1",
  hotel_id: "h",
  room_number: "101",
  room_type: "DOUBLE",
  status: "Available",
  price_cents: 250000,
  ...overrides,
});

const rooms: Room[] = [
  makeRoom({ id: "r1", room_number: "101", room_type: "DOUBLE", status: "Available" }),
  makeRoom({ id: "r2", room_number: "102", room_type: "SUITE", status: "Occupied" }),
  makeRoom({ id: "r3", room_number: "103", room_type: "DOUBLE", status: "Maintenance" }),
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <HMSQueryProvider>
        <RoomsPage />
      </HMSQueryProvider>
    </MemoryRouter>,
  );

const getTab = (name: string) => screen.getByRole("tab", { name });

describe("RoomsPage workspace", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    mockListRooms.mockResolvedValue(rooms);
    mockSearchAvailableRooms.mockResolvedValue([makeRoom({ id: "r1" })]);
    mockGetRoomHoldBoard.mockResolvedValue([]);
    mockGetBookings.mockResolvedValue([]);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("loads /rooms on mount and shows the four tabs with Inventario active", async () => {
    renderPage();

    await waitFor(() => expect(mockListRooms).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(getTab("Inventario")).toHaveAttribute("aria-selected", "true");
    expect(getTab("Disponibilidad")).toBeInTheDocument();
    expect(getTab("Planificador")).toBeInTheDocument();
    expect(getTab("Bloqueos")).toBeInTheDocument();
    const inventoryPanel = await screen.findByRole("tabpanel", { name: "Inventario" }, { timeout: 3000 });
    expect(inventoryPanel).toHaveTextContent("101");
    expect(inventoryPanel).not.toHaveTextContent("Hospedado");
  });

  it("does not load availability, planner or holds before their views open", async () => {
    renderPage();

    await waitFor(() => expect(mockListRooms).toHaveBeenCalledTimes(1));
    expect(mockSearchAvailableRooms).not.toHaveBeenCalled();
    expect(mockGetBookings).not.toHaveBeenCalled();
    expect(mockGetRoomHoldBoard).not.toHaveBeenCalled();

    await userEvent.click(getTab("Planificador"));
    await waitFor(() => expect(mockGetBookings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGetRoomHoldBoard).toHaveBeenCalledTimes(1));
  });

  it("shows Nueva habitación only with rooms.write", async () => {
    renderPage();

    expect(
      await screen.findByRole("button", { name: /Nueva habitación/ }),
    ).toBeInTheDocument();
  });

  it("refreshes the inventory from the header button", async () => {
    renderPage();
    await waitFor(() => expect(mockListRooms).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(mockListRooms).toHaveBeenCalledTimes(2));
  });

  it("shows the inventory error locally and retries", async () => {
    mockListRooms
      .mockRejectedValueOnce({ message: "No se pudo cargar el inventario" })
      .mockResolvedValueOnce(rooms);
    renderPage();

    expect(
      (await screen.findAllByText(/No se pudo cargar el inventario/i, {}, { timeout: 3000 }))
        .length,
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    await waitFor(() => expect(mockListRooms).toHaveBeenCalledTimes(2));
    const inventoryPanel = await screen.findByRole("tabpanel", { name: "Inventario" }, { timeout: 3000 });
    expect(inventoryPanel).toHaveTextContent("101");
  });

  it("keeps the availability view usable when the inventory query fails", async () => {
    mockListRooms.mockRejectedValueOnce({ message: "No se pudo cargar el inventario" });
    renderPage();

    expect(
      (await screen.findAllByText(/No se pudo cargar el inventario/i, {}, { timeout: 3000 }))
        .length,
    ).toBeGreaterThan(0);

    await userEvent.click(getTab("Disponibilidad"));

    const panel = screen.getByRole("tabpanel", { name: "Disponibilidad" });
    expect(within(panel).getByRole("button", { name: /Buscar Habitaciones/i })).toBeInTheDocument();
    expect(
      within(panel).queryByText(/No se pudo cargar el inventario/i),
    ).not.toBeInTheDocument();
  });

  it("removes the legacy landing blocks", async () => {
    renderPage();

    await screen.findAllByText("101", {}, { timeout: 3000 });
    expect(screen.queryByText(/Prioridades del inventario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Que conviene resolver ahora/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Foco del turno/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Accion recomendada/i)).not.toBeInTheDocument();
  });

  it("switches views without scrolling to anchors", async () => {
    renderPage();
    await screen.findAllByText("101", {}, { timeout: 3000 });

    await userEvent.click(getTab("Disponibilidad"));
    expect(
      screen.getByRole("tabpanel", { name: "Disponibilidad" }),
    ).toBeInTheDocument();
    expect(
      document.getElementById("rooms-workspace-panel-inventory"),
    ).toHaveAttribute("hidden");
    expect(
      document.getElementById("rooms-workspace-panel-availability"),
    ).not.toHaveAttribute("hidden");

    await userEvent.click(getTab("Bloqueos"));
    expect(
      screen.getByRole("tabpanel", { name: "Bloqueos" }),
    ).toBeInTheDocument();
    expect(
      document.getElementById("rooms-workspace-panel-availability"),
    ).toHaveAttribute("hidden");
  });

  it("navigates tabs with the keyboard including Home and End", async () => {
    renderPage();
    await screen.findAllByText("101");

    const inventoryTab = getTab("Inventario");
    inventoryTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(getTab("Disponibilidad")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(getTab("Bloqueos")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(getTab("Inventario")).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(getTab("Bloqueos")).toHaveFocus();
  });

  it("shows visible translations with accents", async () => {
    renderPage();
    await screen.findAllByText("101");

    expect(screen.getByText("Inventario, disponibilidad y bloqueos")).toBeInTheDocument();
    expect(getTab("Disponibilidad")).toBeInTheDocument();
    expect(getTab("Planificador")).toBeInTheDocument();
    expect(getTab("Bloqueos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Actualizar/ })).toBeInTheDocument();
  });
});
