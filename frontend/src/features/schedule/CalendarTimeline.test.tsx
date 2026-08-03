import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Booking, Room } from "@/types/domain";
import { buildCalendarAllocations } from "./calendarModel";
import CalendarTimeline from "./CalendarTimeline";

const room: Room = { id: "r1", hotel_id: "h1", room_number: "101", room_type: "DOUBLE", status: "Dirty", price_cents: 100 };
const makeBooking = (overrides: Partial<Booking> = {}): Booking => ({ id: "b1", hotel_id: "h1", room_id: "r1", guest_id: "g1", guest_name: "Ana Gómez", check_in: "2026-08-10", check_out: "2026-08-12", total_price_cents: 100, status: "Confirmed", operational_data: {}, ...overrides });

describe("CalendarTimeline", () => {
  it("renders semantic headers, current room state and empty cells", () => {
    const model = buildCalendarAllocations([room], [makeBooking()], [], { startDate: "2026-08-10", rangeDays: 7 });
    render(<CalendarTimeline rooms={[room]} dates={model.dates} allocationsByRoom={model.allocationsByRoom} conflicts={model.conflicts} onSelect={vi.fn()} onRoom={vi.fn()} />);
    expect(screen.getByRole("table", { name: "Timeline de ocupación" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Habitación/ })).toBeInTheDocument();
    expect(screen.getByText("Estado actual: Dirty")).toBeInTheDocument();
    expect(screen.getAllByText("Sin asignación").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Reserva: Ana Gómez/ })).toHaveLength(2);
  });

  it("shows both allocations when a booking and hold conflict", async () => {
    const user = userEvent.setup();
    const hold = { hold_id: "h1", room_id: "r1", room_number: "101", room_type: "DOUBLE", start_date: "2026-08-10", end_date: "2026-08-11", hold_type: "Maintenance" as const, reason: "Obra" };
    const model = buildCalendarAllocations([room], [makeBooking()], [hold], { startDate: "2026-08-10", rangeDays: 7 });
    const onSelect = vi.fn();
    render(<CalendarTimeline rooms={[room]} dates={model.dates} allocationsByRoom={model.allocationsByRoom} conflicts={model.conflicts} onSelect={onSelect} onRoom={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Conflicto/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1", date: "2026-08-10" }));
  });
});
