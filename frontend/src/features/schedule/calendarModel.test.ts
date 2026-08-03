import { describe, expect, it } from "vitest";
import type { Booking, Room, RoomHoldBoardEntry } from "@/types/domain";
import { buildCalendarAllocations, calendarSummary, dateKeysForRange, occupiesNight } from "./calendarModel";

const room: Room = { id: "r1", hotel_id: "h1", room_number: "101", room_type: "DOUBLE", status: "Available", price_cents: 100 };
const booking = (overrides: Partial<Booking> = {}): Booking => ({ id: "b1", hotel_id: "h1", room_id: "r1", guest_id: "g1", guest_name: "Ana", check_in: "2026-08-10", check_out: "2026-08-12", total_price_cents: 100, status: "Confirmed", operational_data: {}, ...overrides });
const hold = (overrides: Partial<RoomHoldBoardEntry> = {}): RoomHoldBoardEntry => ({ hold_id: "h1", room_id: "r1", room_number: "101", room_type: "DOUBLE", start_date: "2026-08-11", end_date: "2026-08-13", hold_type: "Maintenance", reason: "Obra", ...overrides });

describe("calendarModel", () => {
  it("creates an exact inclusive date window", () => {
    expect(dateKeysForRange({ startDate: "2026-08-10", rangeDays: 7 })).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
  });

  it("uses semi-open booking and hold intervals", () => {
    expect(occupiesNight("2026-08-10", "2026-08-12", "2026-08-10")).toBe(true);
    expect(occupiesNight("2026-08-10", "2026-08-12", "2026-08-11")).toBe(true);
    expect(occupiesNight("2026-08-10", "2026-08-12", "2026-08-12")).toBe(false);
  });

  it("indexes allocations by room and date without cell-level find", () => {
    const model = buildCalendarAllocations([room], [booking()], [hold()], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.allocationsByRoom.get("r1")).toHaveLength(2);
    expect(model.allocationsByDate.get("2026-08-10")).toHaveLength(1);
    expect(model.allocationsByDate.get("2026-08-12")).toHaveLength(2);
  });

  it("does not include cancelled or no-show bookings by default", () => {
    const model = buildCalendarAllocations([room], [booking({ status: "Cancelled" }), booking({ id: "b2", status: "NoShow" })], [], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.allocationsByRoom.size).toBe(0);
    expect(buildCalendarAllocations([room], [booking({ status: "Cancelled" })], [], { startDate: "2026-08-10", rangeDays: 7 }, true).allocationsByRoom.get("r1")).toHaveLength(1);
  });

  it("includes confirmed and checked-in bookings", () => {
    const model = buildCalendarAllocations([room], [booking(), booking({ id: "b2", status: "CheckedIn" })], [], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.allocationsByRoom.get("r1")).toHaveLength(2);
  });

  it("detects overlapping bookings", () => {
    const model = buildCalendarAllocations([room], [booking(), booking({ id: "b2", check_in: "2026-08-11", check_out: "2026-08-13" })], [], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.conflicts.map((conflict) => conflict.date)).toEqual(["2026-08-11"]);
    expect(model.conflicts[0].allocations).toHaveLength(2);
  });

  it("detects a booking and hold overlap", () => {
    const model = buildCalendarAllocations([room], [booking()], [hold()], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.conflicts.map((conflict) => conflict.date)).toEqual(["2026-08-11"]);
  });

  it("keeps a room current status separate from future allocations", () => {
    const maintenanceRoom = { ...room, status: "Maintenance" as const };
    const model = buildCalendarAllocations([maintenanceRoom], [booking()], [], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.roomById.get("r1")?.status).toBe("Maintenance");
    expect(model.allocationsByDate.get("2026-08-10")).toHaveLength(1);
  });

  it("summarizes visible arrivals, departures, holds and conflicts", () => {
    const model = buildCalendarAllocations([room], [booking()], [hold()], { startDate: "2026-08-10", rangeDays: 7 });
    expect(calendarSummary(model, [room])).toMatchObject({ bookings: 1, arrivals: 1, departures: 1, holds: 1, conflicts: 1, rooms: 1 });
  });

  it("does not create orphan allocations for unknown rooms", () => {
    const model = buildCalendarAllocations([room], [booking({ room_id: "unknown" })], [], { startDate: "2026-08-10", rangeDays: 7 });
    expect(model.allocationsByRoom.size).toBe(0);
  });
});
