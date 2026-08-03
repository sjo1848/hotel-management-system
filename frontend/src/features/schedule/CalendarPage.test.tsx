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

  it("keeps bookings visible when holds fail and offers a local retry", async () => {
    getRoomHoldBoard.mockRejectedValueOnce(new Error("holds down"));
    renderPage();
    await waitFor(() => expect(screen.getByText("No se pudieron cargar los bloqueos")).toBeInTheDocument());
    expect(screen.getByText("1 reservas activas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
