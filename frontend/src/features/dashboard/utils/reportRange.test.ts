import { describe, expect, it } from "vitest";
import { getReportRange, DEFAULT_REPORT_RANGE, REPORT_RANGE_LABELS } from "./reportRange";

describe("getReportRange", () => {
  it("defaults to 30 days ending today", () => {
    const now = new Date(2026, 7, 2, 10, 30);
    const range = getReportRange("30d", now);
    expect(range.end).toBe("2026-08-02");
    expect(range.start).toBe("2026-07-04");
  });

  it("computes 7 days including today", () => {
    const now = new Date(2026, 7, 2, 10, 30);
    const range = getReportRange("7d", now);
    expect(range.end).toBe("2026-08-02");
    expect(range.start).toBe("2026-07-27");
  });

  it("crosses month boundaries correctly", () => {
    const now = new Date(2026, 0, 3, 0, 0);
    expect(getReportRange("30d", now).start).toBe("2025-12-05");
    expect(getReportRange("7d", now).start).toBe("2025-12-28");
  });

  it("uses local calendar dates and not UTC timestamps", () => {
    const now = new Date(2026, 7, 2, 23, 59);
    expect(getReportRange("7d", now).end).toBe("2026-08-02");
    const nearMidnight = new Date(2026, 7, 2, 0, 1);
    expect(getReportRange("7d", nearMidnight).start).toBe("2026-07-27");
  });

  it("exposes labels and default range", () => {
    expect(DEFAULT_REPORT_RANGE).toBe("30d");
    expect(REPORT_RANGE_LABELS).toEqual({ "7d": "7 días", "30d": "30 días" });
  });
});
