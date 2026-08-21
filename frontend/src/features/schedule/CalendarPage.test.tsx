import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking, Room } from "@/types/domain";
import CalendarPage from "./CalendarPage";
import { HMSQueryProvider } from "@/lib/QueryProvider";
import { queryClient } from "@/lib/queryClient";
import { AuthContext } from "@/features/auth/AuthContext";

const listRooms = vi.fn();
const getBookings = vi.fn();
const getRoomHoldBoard = vi.fn();
const updateBooking = vi.fn();

vi.mock("@/features/rooms/services/roomService", () => ({ listRooms: (...args: unknown[]) => listRooms(...args), getRoomHoldBoard: (...args: unknown[]) => getRoomHoldBoard(...args) }));
vi.mock("@/features/bookings/services/bookingService", () => ({ getBookings: (...args: unknown[]) => getBookings(...args), updateBooking: (...args: unknown[]) => updateBooking(...args) }));
vi.mock("@/features/bookings/components/BookingDetailsSheet", () => ({ default: () => null }));

const room: Room = { id: "r1", hotel_id: "h1", room_number: "101", room_type: "DOUBLE", status: "Available", price_cents: 100 };
const booking: Booking = { id: "b1", hotel_id: "h1", room_id: "r1", guest_id: "g1", guest_name: "Ana Gómez", check_in: "2026-08-10", check_out: "2026-08-12", total_price_cents: 100, status: "Confirmed", operational_data: {} };

const renderPage = () => render(<MemoryRouter><HMSQueryProvider><AuthContext.Provider value={{ status: "authenticated", user: { id: "u1", username: "admin", hotel_id: "h1", role: "admin" }, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }}><CalendarPage /></AuthContext.Provider></HMSQueryProvider></MemoryRouter>);

describe("CalendarPage", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    listRooms.mockResolvedValue([room]);
    getBookings.mockResolvedValue([booking]);
    getRoomHoldBoard.mockResolvedValue([]);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query.includes("min-width: 768px") || query.includes("min-width: 1280px"), onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  });

  it("loads one query per resource and exposes the planning toolbar", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Calendario" })).toBeInTheDocument();
    await waitFor(() => expect(listRooms).toHaveBeenCalledTimes(1));
    expect(getBookings).toHaveBeenCalledTimes(1);
    expect(getRoomHoldBoard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "7 días" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
  });

  it("moves the exact range and switches presentation without refetching rooms", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(2));
    expect(listRooms).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Timeline" }));
    expect(screen.getByRole("table", { name: "Timeline de ocupación" })).toBeInTheDocument();
  });

  it("preserves desktop controls on tablet widths", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query.includes("min-width: 768px"), onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByText("Incluir canceladas/no-show")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtros" })).not.toBeInTheDocument();
  });

  it("uses an agenda-first mobile surface with secondary filters in a sheet", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query.includes("max-width: 767px"), onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(1));

    expect(screen.queryByRole("button", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agenda" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("group", { name: "Día de agenda" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByRole("heading", { name: "Filtros del calendario" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Sólo conflictos"));
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByRole("button", { name: "Filtros (activos)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Día de agenda" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rango de agenda" })).toBeInTheDocument();
    expect(screen.getByText("Resumen del rango")).toBeInTheDocument();
  });

  it("keeps the mobile header compact and discards unapplied filters", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query.includes("max-width: 767px"), onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText("Encabezado compacto del calendario")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar calendario" })).toBeInTheDocument();
    expect(screen.queryByText("Ocupación, movimientos y bloqueos por fecha")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByLabelText("Sólo conflictos"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Filtros" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filtros (activos)" })).not.toBeInTheDocument();
  });

  it("commits mobile filters only after applying", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.matchMedia = ((query: string) => ({ media: query, matches: query.includes("max-width: 767px"), onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(getBookings).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.click(screen.getByLabelText("Sólo conflictos"));
    expect(screen.getByRole("button", { name: "Aplicar filtros" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByRole("button", { name: "Filtros (activos)" })).toBeInTheDocument();
  });

  it("keeps bookings visible when holds fail and offers a local retry", async () => {
    getRoomHoldBoard.mockRejectedValueOnce(new Error("holds down"));
    renderPage();
    await waitFor(() => expect(screen.getByText("No se pudieron cargar los bloqueos")).toBeInTheDocument());
    expect(screen.getByText("1 reservas activas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
