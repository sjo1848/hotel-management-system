import { describe, expect, it } from "vitest";
import type { HousekeepingBoardRoom, HousekeepingDeparture } from "@/types/domain";
import { buildHousekeepingQueue, filterHousekeepingQueue, operationalDate } from "./housekeepingQueue";

const room = (overrides: Partial<HousekeepingBoardRoom>): HousekeepingBoardRoom => ({ room_id: overrides.room_id ?? "r", room_number: overrides.room_number ?? "101", room_type: "DOUBLE", room_status: "Available", turnover_today: false, ...overrides });
const departure: HousekeepingDeparture = { booking_id: "b", room_id: "r1", room_number: "101", room_type: "DOUBLE", room_status: "Dirty", guest_name: "Ana Gómez", booking_status: "CheckedIn" };

describe("housekeepingQueue", () => {
  it("formats the local operational date", () => expect(operationalDate(new Date(2026, 7, 2))).toBe("2026-08-02"));
  it("prioritizes urgent/high maintenance, turnover and active work", () => {
    const queue = buildHousekeepingQueue([
      room({ room_id: "r1", room_number: "101", room_status: "Dirty", turnover_today: true }),
      room({ room_id: "r2", room_number: "102", room_status: "Maintenance", maintenance_case: { id: "m", hotel_id: "h", room_id: "r2", status: "Open", priority: "Urgent", reason: "Falla", assigned_to: "ops", reported_at: "now" } }),
      room({ room_id: "r3", room_number: "103", room_status: "Cleaning", turnover_today: true }),
    ], []);
    expect(queue.map((item) => item.room_number)).toEqual(["102", "101", "103"]);
  });
  it("marks checked-in departures as blocked", () => expect(buildHousekeepingQueue([room({ room_id: "r1", room_status: "Dirty" })], [departure])[0].isBlocked).toBe(true));
  it("filters by translated state and accented guest search", () => {
    const queue = buildHousekeepingQueue([room({ room_id: "r1", room_number: "101", room_status: "Dirty" })], [departure]);
    expect(filterHousekeepingQueue(queue, "dirty", "ana gomez")).toHaveLength(1);
    expect(filterHousekeepingQueue(queue, "available", "")).toHaveLength(0);
  });
  it("sorts legacy maintenance after explicit priorities", () => {
    const queue = buildHousekeepingQueue([room({ room_id: "r1", room_number: "101", room_status: "Maintenance" }), room({ room_id: "r2", room_number: "102", room_status: "Maintenance", maintenance_case: { id: "m", hotel_id: "h", room_id: "r2", status: "Open", priority: "Low", reason: "Falla", assigned_to: "ops", reported_at: "now" } })], []);
    expect(queue.map((item) => item.room_number)).toEqual(["102", "101"]);
  });
  it("keeps orphan departures as blocked review items", () => {
    const queue = buildHousekeepingQueue([], [departure]);
    expect(queue[0]).toMatchObject({ room_number: "101", isOrphanDeparture: true, isBlocked: true });
  });
});
