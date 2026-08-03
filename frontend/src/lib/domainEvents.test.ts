import { describe, expect, it } from "vitest";
import { getQueryPrefixesForDomainEvent } from "./domainEvents";

describe("getQueryPrefixesForDomainEvent", () => {
  it("rooms.changed invalidates the workspace inventory and availability prefixes", () => {
    const prefixes = getQueryPrefixesForDomainEvent("rooms.changed");
    expect(prefixes).toContain("rooms:list");
    expect(prefixes).toContain("rooms:inventory");
    expect(prefixes).toContain("rooms:availability");
    expect(prefixes).toContain("rooms:holds-board");
    expect(prefixes).toContain("rooms:planner-bookings");
    expect(prefixes).toContain("rooms:detail");
  });

  it("bookings.changed invalidates availability so new bookings refresh the results", () => {
    expect(getQueryPrefixesForDomainEvent("bookings.changed")).toContain("rooms:availability");
  });

  it("keeps dashboard and reports wiring intact", () => {
    expect(getQueryPrefixesForDomainEvent("rooms.changed")).toEqual(
      expect.arrayContaining(["dashboard:home", "reports:"]),
    );
    expect(getQueryPrefixesForDomainEvent("billing.changed")).toEqual(
      expect.arrayContaining(["dashboard:home", "bookings:list", "reports:"]),
    );
  });

  it("unknown events map to no prefixes", () => {
    expect(getQueryPrefixesForDomainEvent("guests.changed")).not.toContain("rooms:inventory");
  });
});
