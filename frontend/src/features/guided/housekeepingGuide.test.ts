import { describe, expect, it } from "vitest";
import {
  buildHousekeepingGuideSteps,
  defaultHousekeepingGuideProgress,
  housekeepingGuideSummary,
  updateHousekeepingGuideProgress,
} from "@/features/guided/housekeepingGuide";

describe("housekeepingGuide", () => {
  it("starts by reviewing the board", () => {
    const steps = buildHousekeepingGuideSteps(defaultHousekeepingGuideProgress(), {
      pendingTurnover: 2,
      inProgress: 0,
      ready: 0,
      blocked: 1,
    });

    expect(steps[0].active).toBe(true);
    expect(steps[1].done).toBe(false);
  });

  it("progresses from review to blocker handling", () => {
    const reviewed = updateHousekeepingGuideProgress(defaultHousekeepingGuideProgress(), "review_board");
    const started = updateHousekeepingGuideProgress(reviewed, "start_cleaning");
    const finished = updateHousekeepingGuideProgress(started, "finish_cleaning");
    const steps = buildHousekeepingGuideSteps(finished, {
      pendingTurnover: 0,
      inProgress: 0,
      ready: 1,
      blocked: 1,
    });

    expect(steps.find((step) => step.id === "review-board")?.done).toBe(true);
    expect(steps.find((step) => step.id === "finish-cleaning")?.done).toBe(true);
    expect(steps.find((step) => step.id === "handle-blocker")?.active).toBe(true);
  });

  it("completes when there are no blockers left", () => {
    const progress = updateHousekeepingGuideProgress(
      updateHousekeepingGuideProgress(
        updateHousekeepingGuideProgress(defaultHousekeepingGuideProgress(), "review_board"),
        "start_cleaning",
      ),
      "finish_cleaning",
    );
    const steps = buildHousekeepingGuideSteps(progress, {
      pendingTurnover: 0,
      inProgress: 0,
      ready: 2,
      blocked: 0,
    });
    const summary = housekeepingGuideSummary(steps);

    expect(summary.completed).toBe(summary.total);
    expect(summary.title).toMatch(/control/i);
  });
});
