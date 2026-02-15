import { describe, expect, it } from "vitest";
import { roleHasCapability } from "./capabilities";

describe("roleHasCapability", () => {
  it("aplica deny-by-default para rol desconocido o vacío", () => {
    expect(roleHasCapability(undefined, "bookings.read")).toBe(false);
    expect(roleHasCapability("unknown", "bookings.read")).toBe(false);
  });

  it("permite capacidades SaaS solo a admin/saas_admin", () => {
    expect(roleHasCapability("admin", "saas.hotels.read")).toBe(true);
    expect(roleHasCapability("saas_admin", "saas.hotels.write")).toBe(true);
    expect(roleHasCapability("ops", "saas.hotels.read")).toBe(false);
  });

  it("respeta capacidades operativas por rol", () => {
    expect(roleHasCapability("ops", "reports.revenue.read")).toBe(true);
    expect(roleHasCapability("ops", "audit.events.read")).toBe(true);
    expect(roleHasCapability("receptionist", "reports.revenue.read")).toBe(false);
    expect(roleHasCapability("housekeeping", "housekeeping.read")).toBe(true);
    expect(roleHasCapability("housekeeping", "bookings.read")).toBe(false);
  });
});
