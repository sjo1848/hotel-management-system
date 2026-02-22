import { invalidateResourcePrefix } from "@/lib/useResourceQuery";

export const HMS_DOMAIN_EVENT = "hms:domain-event";

export type DomainEventName =
  | "booking_created"
  | "booking_updated"
  | "booking_checked_out"
  | "booking_cancelled"
  | "extra_charge_added"
  | "cash_closed"
  | "room_status_updated"
  | "guest_created"
  | "user_created"
  | "user_deleted";

export type DomainEventPayload = Record<string, unknown>;

export type DomainEvent = {
  name: DomainEventName;
  payload: DomainEventPayload;
  timestamp: string;
};

const DOMAIN_EVENT_INVALIDATION_MAP: Record<DomainEventName, string[]> = {
  booking_created: ["bookings:list", "rooms:list", "dashboard:home"],
  booking_updated: ["bookings:list", "dashboard:home"],
  booking_checked_out: ["bookings:list", "dashboard:home"],
  booking_cancelled: ["bookings:list", "dashboard:home"],
  extra_charge_added: ["bookings:list", "dashboard:home"],
  cash_closed: ["dashboard:home"],
  room_status_updated: ["rooms:list", "dashboard:home"],
  guest_created: ["guests:list"],
  user_created: ["users:list"],
  user_deleted: ["users:list"],
};

let invalidationBound = false;

export const bindDomainEventInvalidation = () => {
  if (typeof window === "undefined" || invalidationBound) return;
  invalidationBound = true;
  window.addEventListener(HMS_DOMAIN_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<DomainEvent>).detail;
    const prefixes = DOMAIN_EVENT_INVALIDATION_MAP[detail.name] ?? [];
    prefixes.forEach((prefix) => {
      invalidateResourcePrefix(prefix, { refetchActive: true });
    });
  });
};

export const emitDomainEvent = (
  name: DomainEventName,
  payload: DomainEventPayload = {},
) => {
  if (typeof window === "undefined") return;
  const envelope: DomainEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent<DomainEvent>(HMS_DOMAIN_EVENT, {
      detail: envelope,
    }),
  );
};

bindDomainEventInvalidation();
