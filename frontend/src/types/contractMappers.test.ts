import { describe, expect, it } from "vitest";
import { toBooking, toRoom } from "./contractMappers";

describe("contractMappers", () => {
  it("normalizes booking status from backend/legacy variants", () => {
    const booking = toBooking({
      id: "b1",
      hotel_id: "h1",
      room_id: "r1",
      guest_id: undefined,
      guest_name: "Guest",
      check_in: "2026-02-20",
      check_out: "2026-02-21",
      total_price_cents: 1000,
      status: "CHECKED_IN",
    });
    expect(booking.status).toBe("CheckedIn");
    expect(booking.guest_id).toBeNull();
  });

  it("falls back booking status to Confirmed when unknown", () => {
    const booking = toBooking({
      id: "b2",
      hotel_id: "h1",
      room_id: "r1",
      guest_id: null,
      guest_name: "Guest",
      check_in: "2026-02-20",
      check_out: "2026-02-21",
      total_price_cents: 1000,
      status: "something_else",
    });
    expect(booking.status).toBe("Confirmed");
  });

  it("normalizes room status from backend/legacy variants", () => {
    const room = toRoom({
      id: "r1",
      hotel_id: "h1",
      room_number: "101",
      room_type: "SINGLE",
      price_cents: 5000,
      status: "available",
    });
    expect(room.status).toBe("Available");
  });

  it("falls back room status to Maintenance when unknown", () => {
    const room = toRoom({
      id: "r2",
      hotel_id: "h1",
      room_number: "102",
      room_type: "SINGLE",
      price_cents: 5000,
      status: "non-existent-status",
    });
    expect(room.status).toBe("Maintenance");
  });
});
