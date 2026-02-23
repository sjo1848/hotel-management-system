export type DomainEventName =
  | "bookings.changed"
  | "guests.changed"
  | "rooms.changed"
  | "users.changed"
  | "billing.changed"
  | "hotels.changed";

type DomainEventPayload = Record<string, unknown>;

type DomainEventEnvelope = {
  event: DomainEventName;
  payload?: DomainEventPayload;
  timestamp: string;
};

const DOMAIN_EVENT_NAME = "hms:domain-event";

const EVENT_TO_QUERY_PREFIXES: Record<DomainEventName, string[]> = {
  "bookings.changed": ["bookings:list", "dashboard:home", "reports:"],
  "guests.changed": ["guests:list", "bookings:list", "dashboard:home"],
  "rooms.changed": ["rooms:list", "dashboard:home", "reports:"],
  "users.changed": ["users:list"],
  "billing.changed": ["dashboard:home", "bookings:list", "reports:"],
  "hotels.changed": ["network:hotels", "hotels:list"],
};

export const emitDomainEvent = (event: DomainEventName, payload?: DomainEventPayload) => {
  if (typeof window === "undefined") return;
  const envelope: DomainEventEnvelope = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(
    new CustomEvent<DomainEventEnvelope>(DOMAIN_EVENT_NAME, {
      detail: envelope,
    }),
  );
};

export const getQueryPrefixesForDomainEvent = (event: DomainEventName): string[] =>
  EVENT_TO_QUERY_PREFIXES[event] ?? [];

export const subscribeDomainEvents = (
  onEvent: (event: DomainEventEnvelope) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => undefined;

  const handler = (browserEvent: Event) => {
    const customEvent = browserEvent as CustomEvent<DomainEventEnvelope>;
    if (!customEvent.detail?.event) return;
    onEvent(customEvent.detail);
  };

  window.addEventListener(DOMAIN_EVENT_NAME, handler as EventListener);
  return () => {
    window.removeEventListener(DOMAIN_EVENT_NAME, handler as EventListener);
  };
};
