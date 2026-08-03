import { describe, expect, it } from "vitest";
import {
  buildReceptionGuideSteps,
  defaultReceptionGuideProgress,
  receptionGuideSummary,
  updateReceptionGuideProgress,
} from "@/features/guided/receptionGuide";

describe("receptionGuide", () => {
  it("starts with the open-case step active and each step carries a navigation action", () => {
    const steps = buildReceptionGuideSteps(defaultReceptionGuideProgress(), "Confirmed");

    expect(steps[0].id).toBe("open-case");
    expect(steps[0].active).toBe(true);
    expect(steps[0].actionLabel).toBe("Ir a la cola");
    for (const step of steps) {
      expect(step.actionLabel).toBeTruthy();
      expect(step.done).toBe(false);
    }
  });

  it("only marks steps done via operational events, never by reading steps", () => {
    const progress = defaultReceptionGuideProgress();
    const steps = buildReceptionGuideSteps(progress, "Confirmed");

    steps.forEach((step) => {
      expect(step.done).toBe(false);
    });

    const opened = updateReceptionGuideProgress(progress, "open_case");
    expect(opened.openCaseDone).toBe(true);
    expect(opened.checkInDone).toBe(false);

    const reviewed = updateReceptionGuideProgress(opened, "review_case");
    expect(reviewed.reviewCaseDone).toBe(true);
    expect(reviewed.checkInDone).toBe(false);
  });

  it("activates the check-in step only for confirmed bookings", () => {
    const reviewed = updateReceptionGuideProgress(
      updateReceptionGuideProgress(defaultReceptionGuideProgress(), "open_case"),
      "review_case",
    );

    const stepsConfirmed = buildReceptionGuideSteps(reviewed, "Confirmed");
    expect(stepsConfirmed.find((step) => step.id === "check-in")?.active).toBe(true);

    const stepsCheckedIn = buildReceptionGuideSteps(reviewed, "CheckedIn");
    expect(stepsCheckedIn.find((step) => step.id === "check-in")?.active).toBe(false);
    expect(stepsCheckedIn.find((step) => step.id === "payment")?.active).toBe(true);
  });

  it("progresses through payment and completes the guide after checkout", () => {
    const paid = updateReceptionGuideProgress(
      updateReceptionGuideProgress(
        updateReceptionGuideProgress(
          updateReceptionGuideProgress(defaultReceptionGuideProgress(), "open_case"),
          "review_case",
        ),
        "checkin_complete",
      ),
      "payment_registered",
    );
    const steps = buildReceptionGuideSteps(paid, "CheckedIn");
    expect(steps.find((step) => step.id === "payment")?.done).toBe(true);
    expect(steps.find((step) => step.id === "checkout")?.active).toBe(true);

    const done = updateReceptionGuideProgress(paid, "checkout_complete");
    const completedSteps = buildReceptionGuideSteps(done, "CheckedOut");
    const summary = receptionGuideSummary(completedSteps);

    expect(summary.completed).toBe(summary.total);
    expect(summary.title).toMatch(/Turno guiado completo/i);
  });
});
