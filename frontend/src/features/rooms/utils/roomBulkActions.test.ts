import { describe, expect, it } from "vitest";
import {
  canApplyBulkTo,
  getStatusBreakdown,
  validateBulkSelection,
} from "./roomBulkActions";

describe("canApplyBulkTo", () => {
  it("Marcar disponibles only accepts Cleaning and Available", () => {
    const toAvailable = canApplyBulkTo("AVAILABLE");
    expect(toAvailable("Cleaning")).toBe(true);
    expect(toAvailable("Available")).toBe(true);
    expect(toAvailable("Occupied")).toBe(false);
    expect(toAvailable("Dirty")).toBe(false);
    expect(toAvailable("Maintenance")).toBe(false);
  });

  it("Enviar a limpieza only accepts Occupied and Dirty", () => {
    const toDirty = canApplyBulkTo("DIRTY");
    expect(toDirty("Occupied")).toBe(true);
    expect(toDirty("Dirty")).toBe(true);
    expect(toDirty("Available")).toBe(false);
    expect(toDirty("Cleaning")).toBe(false);
    expect(toDirty("Maintenance")).toBe(false);
  });
});

describe("getStatusBreakdown", () => {
  it("counts every contract status", () => {
    expect(
      getStatusBreakdown(["Cleaning", "Available", "Occupied", "Dirty", "Maintenance", "Available"]),
    ).toEqual({
      Available: 2,
      Occupied: 1,
      Dirty: 1,
      Cleaning: 1,
      Maintenance: 1,
    });
  });
});

describe("validateBulkSelection", () => {
  it("Cleaning -> Available is valid", () => {
    expect(validateBulkSelection(["Cleaning"], "AVAILABLE").valid).toBe(true);
  });

  it("Available -> Available no-op is valid", () => {
    expect(validateBulkSelection(["Available"], "AVAILABLE").valid).toBe(true);
  });

  it("Occupied -> Dirty is valid", () => {
    expect(validateBulkSelection(["Occupied"], "DIRTY").valid).toBe(true);
  });

  it("Dirty -> Dirty no-op is valid", () => {
    expect(validateBulkSelection(["Dirty"], "DIRTY").valid).toBe(true);
  });

  it("Occupied cannot become Available", () => {
    const result = validateBulkSelection(["Occupied"], "AVAILABLE");
    expect(result.valid).toBe(false);
    expect(result.blocking).toEqual(["Occupied"]);
  });

  it("Cleaning cannot become Dirty", () => {
    const result = validateBulkSelection(["Cleaning"], "DIRTY");
    expect(result.valid).toBe(false);
    expect(result.blocking).toEqual(["Cleaning"]);
  });

  it("Maintenance always blocks the batch", () => {
    const mixed = validateBulkSelection(["Cleaning", "Maintenance"], "AVAILABLE");
    expect(mixed.valid).toBe(false);
    expect(mixed.blocking).toEqual(["Maintenance"]);

    const dirty = validateBulkSelection(["Dirty", "Maintenance"], "DIRTY");
    expect(dirty.valid).toBe(false);
    expect(dirty.blocking).toEqual(["Maintenance"]);
  });

  it("mixed batch with multiple blockers reports them all without duplicates", () => {
    const result = validateBulkSelection(
      ["Cleaning", "Available", "Occupied", "Maintenance"],
      "AVAILABLE",
    );
    expect(result.valid).toBe(false);
    expect(result.blocking.sort()).toEqual(["Maintenance", "Occupied"]);
  });

  it("empty selection is valid but has nothing to report", () => {
    const result = validateBulkSelection([], "AVAILABLE");
    expect(result.valid).toBe(true);
    expect(result.blocking).toEqual([]);
  });
});
