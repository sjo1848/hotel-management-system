import { describe, expect, it } from "vitest";
import type { Room } from "@/types/domain";
import {
  buildRoomStatusCounts,
  filterRooms,
  filterRoomsByStatus,
  matchesSearchTerm,
  normalizeSearchTerm,
} from "./roomInventoryFilter";

const makeRoom = (overrides: Partial<Room>): Room => ({
  id: "1",
  hotel_id: "h",
  room_number: "101",
  room_type: "DOUBLE",
  status: "Available",
  price_cents: 250000,
  ...overrides,
});

const inventory: Room[] = [
  makeRoom({ id: "1", room_number: "101", room_type: "DOUBLE", status: "Available" }),
  makeRoom({ id: "2", room_number: "102", room_type: "SUITE", status: "Occupied" }),
  makeRoom({ id: "3", room_number: "103", room_type: "DOUBLE", status: "Dirty" }),
  makeRoom({ id: "4", room_number: "104", room_type: "SINGLE", status: "Cleaning" }),
  makeRoom({ id: "5", room_number: "201", room_type: "SUITE", status: "Maintenance" }),
];

describe("normalizeSearchTerm", () => {
  it("trims, lowercases and strips accents", () => {
    expect(normalizeSearchTerm("  Habitación ")).toBe("habitacion");
    expect(normalizeSearchTerm("Gestión")).toBe("gestion");
  });
});

describe("matchesSearchTerm", () => {
  it("matches by room number", () => {
    expect(matchesSearchTerm(inventory[0], "101")).toBe(true);
    expect(matchesSearchTerm(inventory[0], "10")).toBe(true);
  });

  it("matches by room type", () => {
    expect(matchesSearchTerm(inventory[1], "suite")).toBe(true);
    expect(matchesSearchTerm(inventory[0], "double")).toBe(true);
  });

  it("matches translated statuses without accents", () => {
    expect(matchesSearchTerm(inventory[0], "disponible")).toBe(true);
    expect(matchesSearchTerm(inventory[1], "ocupada")).toBe(true);
    expect(matchesSearchTerm(inventory[1], "ocupado")).toBe(true);
    expect(matchesSearchTerm(inventory[4], "mantenimiento")).toBe(true);
  });

  it("limpieza finds both Dirty and Cleaning", () => {
    expect(matchesSearchTerm(inventory[2], "limpieza")).toBe(true);
    expect(matchesSearchTerm(inventory[3], "limpieza")).toBe(true);
    expect(matchesSearchTerm(inventory[0], "limpieza")).toBe(false);
  });

  it("accepts english contract values", () => {
    expect(matchesSearchTerm(inventory[0], "available")).toBe(true);
    expect(matchesSearchTerm(inventory[2], "dirty")).toBe(true);
    expect(matchesSearchTerm(inventory[3], "cleaning")).toBe(true);
  });

  it("empty term matches everything", () => {
    expect(matchesSearchTerm(inventory[0], "   ")).toBe(true);
  });
});

describe("filterRoomsByStatus", () => {
  it("filters by each chip with the real contract statuses", () => {
    expect(filterRoomsByStatus(inventory, "all")).toHaveLength(5);
    expect(filterRoomsByStatus(inventory, "available").map((r) => r.id)).toEqual(["1"]);
    expect(filterRoomsByStatus(inventory, "occupied").map((r) => r.id)).toEqual(["2"]);
    expect(filterRoomsByStatus(inventory, "maintenance").map((r) => r.id)).toEqual(["5"]);
  });

  it("cleaning groups Dirty and Cleaning without losing exact status", () => {
    const cleaning = filterRoomsByStatus(inventory, "cleaning");
    expect(cleaning.map((r) => r.id).sort()).toEqual(["3", "4"]);
    expect(cleaning.find((r) => r.id === "3")?.status).toBe("Dirty");
    expect(cleaning.find((r) => r.id === "4")?.status).toBe("Cleaning");
  });
});

describe("filterRooms", () => {
  it("combines search and status filter", () => {
    const result = filterRooms(inventory, "double", "cleaning");
    expect(result.map((r) => r.id)).toEqual(["3"]);
  });
});

describe("buildRoomStatusCounts", () => {
  it("counts on the full inventory collection", () => {
    expect(buildRoomStatusCounts(inventory)).toEqual({
      total: 5,
      available: 1,
      occupied: 1,
      cleaning: 2,
      maintenance: 1,
    });
  });

  it("returns zero counts for empty inventory", () => {
    expect(buildRoomStatusCounts([])).toEqual({
      total: 0,
      available: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
    });
  });
});
