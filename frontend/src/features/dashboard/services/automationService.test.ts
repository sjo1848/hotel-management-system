import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/api/sdk";
import { getAutomationInsights } from "./automationService";

vi.mock("@/api/sdk", () => ({
  apiGet: vi.fn(),
}));

describe("automationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps automations insights payload with safe defaults", async () => {
    (apiGet as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      plan_tier: "PRO",
      feature_flags: {
        revenue_cockpit: true,
        housekeeping_sla_alerts: true,
        pricing_assistant: true,
        exception_notifications: true,
        hq_multi_property: true,
        benchmarking_exports: false,
        pricing_rules_automation: false,
      },
      housekeeping_sla: {
        enabled: true,
        dirty_rooms_count: 7,
        cleaning_rooms_count: 2,
        overdue_rooms_count: 2,
        recommendation: "Reasignar personal.",
      },
      pricing_assistant: {
        enabled: true,
        occupancy_rate: 58.2,
        adr_cents: 11200,
        rev_par_cents: 6518,
        urgency: "high",
        recommendation: "Activar promo 72h.",
      },
      exception_notifications: [
        {
          code: "LOW_OCCUPANCY_ALERT",
          severity: "medium",
          message: "Ocupación baja.",
          action_route: "/reports",
        },
      ],
    });

    const response = await getAutomationInsights();

    expect(apiGet).toHaveBeenCalledWith("/automations/insights");
    expect(response.plan_tier).toBe("PRO");
    expect(response.feature_flags.pricing_assistant).toBe(true);
    expect(response.exception_notifications[0].action_route).toBe("/reports");
  });
});
