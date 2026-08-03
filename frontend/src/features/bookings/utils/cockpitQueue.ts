import type { FrontDeskBoardEntry, FrontDeskQueueItem } from "@/types/domain";

export type QueueFilter = "all" | "urgent" | "arrivals" | "departures" | "in-house";

export const queueFilters: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "urgent", label: "Urgentes" },
  { value: "arrivals", label: "Llegadas" },
  { value: "departures", label: "Salidas" },
  { value: "in-house", label: "En casa" },
];

export const normalizedSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export type LaneIdSets = {
  readyArrivalIds: Set<string>;
  blockedArrivalIds: Set<string>;
  departureIds: Set<string>;
  inHouseIds: Set<string>;
};

export const buildLaneIdSets = (
  readyArrivals: FrontDeskBoardEntry[],
  blockedArrivals: FrontDeskBoardEntry[],
  departures: FrontDeskBoardEntry[],
  inHouse: FrontDeskBoardEntry[],
): LaneIdSets => ({
  readyArrivalIds: new Set(readyArrivals.map((entry) => entry.booking_id)),
  blockedArrivalIds: new Set(blockedArrivals.map((entry) => entry.booking_id)),
  departureIds: new Set(departures.map((entry) => entry.booking_id)),
  inHouseIds: new Set(inHouse.map((entry) => entry.booking_id)),
});

export type CockpitQueueInput = {
  actionQueue: FrontDeskQueueItem[];
  readyArrivals: FrontDeskBoardEntry[];
  blockedArrivals: FrontDeskBoardEntry[];
  departures: FrontDeskBoardEntry[];
  inHouse: FrontDeskBoardEntry[];
};

export const buildCockpitQueue = ({
  actionQueue,
  readyArrivals,
  blockedArrivals,
  departures,
  inHouse,
}: CockpitQueueInput): FrontDeskQueueItem[] => {
  const queuedIds = new Set(actionQueue.map((item) => item.entry.booking_id));
  const appendMissing = (
    entries: FrontDeskBoardEntry[],
    createItem: (entry: FrontDeskBoardEntry) => FrontDeskQueueItem,
  ) =>
    entries.flatMap((entry) => {
      if (queuedIds.has(entry.booking_id)) return [];
      queuedIds.add(entry.booking_id);
      return [createItem(entry)];
    });
  const missingBlocked = appendMissing(blockedArrivals, (entry) => ({
    entry,
    lane: "Bloqueada",
    title: entry.blocker?.title ?? "Llegada bloqueada",
    detail: entry.blocker?.detail ?? "La llegada necesita una resolución operativa.",
    primary_label: "Revisar bloqueo",
    action_kind: "open-booking",
  }));
  const missingDepartures = appendMissing(departures, (entry) => ({
    entry,
    lane: "Salida",
    title: "Salida pendiente",
    detail: "Revisá cuenta, habitación y handoff antes de cerrar el checkout.",
    primary_label: "Preparar checkout",
    action_kind: "open-booking",
  }));
  const missingReady = appendMissing(readyArrivals, (entry) => ({
    entry,
    lane: "Llegada",
    title: "Llegada lista",
    detail: "La habitación está disponible para completar la recepción.",
    primary_label: "Hacer check-in",
    action_kind: "prepare-check-in",
  }));
  const missingInHouse = appendMissing(inHouse, (entry) => ({
    entry,
    lane: "En casa",
    title: "Estadia activa",
    detail: "Seguimiento de cuenta, habitacion y excepciones durante la estadia.",
    primary_label: "Gestionar estadia",
    action_kind: "open-booking",
  }));
  return [
    ...actionQueue,
    ...missingBlocked,
    ...missingDepartures,
    ...missingReady,
    ...missingInHouse,
  ];
};

export const filterCockpitQueue = ({
  queue,
  searchQuery,
  queueFilter,
  laneIds,
}: {
  queue: FrontDeskQueueItem[];
  searchQuery: string;
  queueFilter: QueueFilter;
  laneIds: LaneIdSets;
}): FrontDeskQueueItem[] => {
  const query = normalizedSearch(searchQuery);
  return queue.filter((item) => {
    const bookingId = item.entry.booking_id;
    const matchesFilter =
      queueFilter === "all" ||
      (queueFilter === "urgent" &&
        (laneIds.blockedArrivalIds.has(bookingId) || laneIds.departureIds.has(bookingId))) ||
      (queueFilter === "arrivals" &&
        (laneIds.readyArrivalIds.has(bookingId) || laneIds.blockedArrivalIds.has(bookingId))) ||
      (queueFilter === "departures" && laneIds.departureIds.has(bookingId)) ||
      (queueFilter === "in-house" && laneIds.inHouseIds.has(bookingId));
    if (!matchesFilter) return false;
    if (!query) return true;
    return normalizedSearch(
      [
        item.entry.guest_name,
        item.entry.room_number,
        item.entry.room_type,
        item.entry.booking_id,
        item.lane,
        item.title,
        item.detail,
        item.entry.blocker?.title ?? "",
        item.entry.blocker?.detail ?? "",
      ].join(" "),
    ).includes(query);
  });
};
