import { describe, expect, it } from "vitest";

import type { FrontDeskBoardEntry, FrontDeskQueueItem } from "@/types/domain";
import {
  buildCockpitQueue,
  buildLaneIdSets,
  filterCockpitQueue,
  normalizedSearch,
  queueFilters,
  type LaneIdSets,
  type QueueFilter,
} from "./cockpitQueue";

const entry = (overrides: Partial<FrontDeskBoardEntry>) => ({
  booking_id: "booking-1",
  room_id: "room-1",
  room_number: "101",
  room_type: "Single",
  guest_name: "Ana Lista",
  check_in: "2026-03-01",
  check_out: "2026-03-03",
  booking_status: "Confirmed" as const,
  room_status: "Available" as const,
  total_price_cents: 20_000,
  operational_data: {},
  ...overrides,
});

const input = {
  actionQueue: [
    {
      entry: entry({ booking_id: "ready-1", guest_name: "Ana Lista" }),
      lane: "Llegada",
      title: "Llegada lista",
      detail: "La habitación está disponible para completar la recepción.",
      primary_label: "Hacer check-in",
      action_kind: "prepare-check-in" as const,
    },
  ],
  readyArrivals: [
    entry({ booking_id: "ready-1", guest_name: "Ana Lista" }),
    entry({ booking_id: "ready-2", guest_name: "Carla Pronta" }),
  ],
  blockedArrivals: [
    entry({
      booking_id: "blocked-1",
      guest_name: "Blanca Bloqueo",
      blocker: {
        kind: "hold",
        title: "Bloqueo de mantenimiento",
        detail: "Reparación de aire acondicionado en curso.",
      },
    }),
  ],
  departures: [entry({ booking_id: "depart-1", guest_name: "Diego Salida", room_number: "104" })],
  inHouse: [entry({ booking_id: "inhouse-1", guest_name: "Juan Juárez" })],
};

const idsOf = (queue: FrontDeskQueueItem[]) => queue.map((item) => item.entry.booking_id);

describe("buildCockpitQueue", () => {
  it("keeps the action queue first and then appends lanes in priority order", () => {
    const queue = buildCockpitQueue(input);

    expect(idsOf(queue)).toEqual([
      "ready-1",
      "blocked-1",
      "depart-1",
      "ready-2",
      "inhouse-1",
    ]);
  });

  it("does not duplicate a booking present in the action queue and a lane", () => {
    const queue = buildCockpitQueue(input);

    expect(idsOf(queue).filter((id) => id === "ready-1")).toHaveLength(1);
    expect(idsOf(queue)).toHaveLength(5);
  });

  it("appends fallbacks only for missing entries with lane metadata", () => {
    const queue = buildCockpitQueue({
      actionQueue: [],
      readyArrivals: input.readyArrivals,
      blockedArrivals: input.blockedArrivals,
      departures: input.departures,
      inHouse: input.inHouse,
    });

    expect(idsOf(queue)).toEqual([
      "blocked-1",
      "depart-1",
      "ready-1",
      "ready-2",
      "inhouse-1",
    ]);
    expect(queue[0]).toMatchObject({
      lane: "Bloqueada",
      title: "Bloqueo de mantenimiento",
      primary_label: "Revisar bloqueo",
      action_kind: "open-booking",
    });
    expect(queue[1]).toMatchObject({ lane: "Salida", action_kind: "open-booking" });
    expect(queue[2]).toMatchObject({ lane: "Llegada", action_kind: "prepare-check-in" });
    expect(queue[4]).toMatchObject({ lane: "En casa", action_kind: "open-booking" });
  });

  it("returns an empty queue when there is nothing pending", () => {
    expect(
      buildCockpitQueue({
        actionQueue: [],
        readyArrivals: [],
        blockedArrivals: [],
        departures: [],
        inHouse: [],
      }),
    ).toEqual([]);
  });
});

const buildQueue = (overrides: Partial<typeof input> = {}) =>
  buildCockpitQueue({ ...input, ...overrides });

const laneIds: LaneIdSets = buildLaneIdSets(
  input.readyArrivals,
  input.blockedArrivals,
  input.departures,
  input.inHouse,
);

const filterBy = (queue: FrontDeskQueueItem[], filter: QueueFilter, searchQuery = "") =>
  filterCockpitQueue({ queue, searchQuery, queueFilter: filter, laneIds });

describe("filterCockpitQueue", () => {
  it("keeps every case with the all filter", () => {
    expect(idsOf(filterBy(buildQueue(), "all"))).toEqual(idsOf(buildQueue()));
  });

  it("filters urgent to blocked and departures", () => {
    const urgent = idsOf(filterBy(buildQueue(), "urgent"));

    expect(urgent).toEqual(["blocked-1", "depart-1"]);
  });

  it("filters arrivals to ready and blocked arrivals", () => {
    expect(idsOf(filterBy(buildQueue(), "arrivals"))).toEqual([
      "ready-1",
      "blocked-1",
      "ready-2",
    ]);
  });

  it("filters departures and in-house lanes", () => {
    expect(idsOf(filterBy(buildQueue(), "departures"))).toEqual(["depart-1"]);
    expect(idsOf(filterBy(buildQueue(), "in-house"))).toEqual(["inhouse-1"]);
  });

  it("searches normalizing accents", () => {
    expect(idsOf(filterBy(buildQueue(), "all", "juarez"))).toEqual(["inhouse-1"]);
    expect(idsOf(filterBy(buildQueue(), "all", "JUÁREZ"))).toEqual(["inhouse-1"]);
  });

  it("searches by guest, room, booking id, lane, title, detail and blocker", () => {
    expect(idsOf(filterBy(buildQueue(), "all", "104"))).toEqual(["depart-1"]);
    expect(idsOf(filterBy(buildQueue(), "all", "ready-2"))).toEqual(["ready-2"]);
    expect(idsOf(filterBy(buildQueue(), "all", "aire acondicionado"))).toEqual(["blocked-1"]);
    expect(idsOf(filterBy(buildQueue(), "all", "Salida pendiente"))).toEqual(["depart-1"]);
  });

  it("returns no results when nothing matches", () => {
    expect(filterBy(buildQueue(), "all", "caso inexistente")).toEqual([]);
  });

  it("exposes the documented filter options", () => {
    expect(queueFilters.map((filter) => filter.value)).toEqual([
      "all",
      "urgent",
      "arrivals",
      "departures",
      "in-house",
    ]);
  });
});

describe("normalizedSearch", () => {
  it("strips accents, lowercases and trims", () => {
    expect(normalizedSearch("  José Pérez  ")).toBe("jose perez");
  });
});
