import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Booking, Room } from "@/types/domain";
import { buildCalendarAllocations } from "./calendarModel";
import CalendarAgenda from "./CalendarAgenda";

const room: Room = { id: "r1", hotel_id: "h1", room_number: "101", room_type: "DOUBLE", status: "Available", price_cents: 100 };
const booking: Booking = { id: "b1", hotel_id: "h1", room_id: "r1", guest_id: "g1", guest_name: "Ana Gómez", check_in: "2026-08-10", check_out: "2026-08-12", total_price_cents: 100, status: "Confirmed", operational_data: {} };

describe("CalendarAgenda", () => {
  it("groups a reservation once as a landing movement", () => {
    const model = buildCalendarAllocations([room], [booking], [], { startDate: "2026-08-10", rangeDays: 7 });
    render(<CalendarAgenda dates={model.dates} selectedDate="2026-08-10" items={model.allocationsByDate.get("2026-08-10") ?? []} conflicts={model.conflicts} onDateChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText("Llegadas")).toBeInTheDocument();
    expect(screen.getByText(/Ana Gómez/)).toBeInTheDocument();
    expect(screen.queryByText("En casa")).not.toBeInTheDocument();
  });

  it("changes the selected day and exposes an empty state", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();
    render(<CalendarAgenda dates={["2026-08-10", "2026-08-11"]} selectedDate="2026-08-11" items={[]} conflicts={[]} onDateChange={onDateChange} onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /lun 10/ }));
    expect(onDateChange).toHaveBeenCalledWith("2026-08-10");
    expect(screen.getByText("No hay movimientos ni bloqueos visibles para esta fecha")).toBeInTheDocument();
  });
});
