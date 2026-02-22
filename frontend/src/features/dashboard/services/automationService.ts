import { apiGet } from "@/api/sdk";
import type { components } from "@/api/generated/openapi";
import type { PlanTier } from "@/types/domain";

type AutomationInsightsRaw = components["schemas"]["AutomationInsightsResponse"];
type PlanFeatureFlagsRaw = components["schemas"]["PlanFeatureFlags"];
type HousekeepingSlaInsightRaw = components["schemas"]["HousekeepingSlaInsight"];
type PricingAssistantInsightRaw = components["schemas"]["PricingAssistantInsight"];
type AutomationNotificationRaw = components["schemas"]["AutomationNotification"];

export type PlanFeatureFlags = {
  revenue_cockpit: boolean;
  housekeeping_sla_alerts: boolean;
  pricing_assistant: boolean;
  exception_notifications: boolean;
  hq_multi_property: boolean;
  benchmarking_exports: boolean;
  pricing_rules_automation: boolean;
};

export type HousekeepingSlaInsight = {
  enabled: boolean;
  dirty_rooms_count: number;
  cleaning_rooms_count: number;
  overdue_rooms_count: number;
  recommendation: string;
};

export type PricingAssistantInsight = {
  enabled: boolean;
  occupancy_rate: number;
  adr_cents: number;
  rev_par_cents: number;
  urgency: "low" | "medium" | "high" | "upgrade_required";
  recommendation: string;
};

export type AutomationNotification = {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  message: string;
  action_route: string;
};

export type AutomationInsights = {
  plan_tier: PlanTier;
  feature_flags: PlanFeatureFlags;
  housekeeping_sla: HousekeepingSlaInsight;
  pricing_assistant: PricingAssistantInsight;
  exception_notifications: AutomationNotification[];
};

const toPlanFeatureFlags = (raw?: PlanFeatureFlagsRaw): PlanFeatureFlags => ({
  revenue_cockpit: raw?.revenue_cockpit ?? false,
  housekeeping_sla_alerts: raw?.housekeeping_sla_alerts ?? false,
  pricing_assistant: raw?.pricing_assistant ?? false,
  exception_notifications: raw?.exception_notifications ?? false,
  hq_multi_property: raw?.hq_multi_property ?? false,
  benchmarking_exports: raw?.benchmarking_exports ?? false,
  pricing_rules_automation: raw?.pricing_rules_automation ?? false,
});

const toHousekeepingSlaInsight = (
  raw?: HousekeepingSlaInsightRaw,
): HousekeepingSlaInsight => ({
  enabled: raw?.enabled ?? false,
  dirty_rooms_count: raw?.dirty_rooms_count ?? 0,
  cleaning_rooms_count: raw?.cleaning_rooms_count ?? 0,
  overdue_rooms_count: raw?.overdue_rooms_count ?? 0,
  recommendation: raw?.recommendation ?? "",
});

const toPricingAssistantInsight = (
  raw?: PricingAssistantInsightRaw,
): PricingAssistantInsight => ({
  enabled: raw?.enabled ?? false,
  occupancy_rate: raw?.occupancy_rate ?? 0,
  adr_cents: raw?.adr_cents ?? 0,
  rev_par_cents: raw?.rev_par_cents ?? 0,
  urgency:
    (raw?.urgency as PricingAssistantInsight["urgency"] | undefined) ??
    "upgrade_required",
  recommendation: raw?.recommendation ?? "",
});

const toAutomationNotification = (
  raw: AutomationNotificationRaw,
): AutomationNotification => ({
  code: raw.code ?? "",
  severity: (raw.severity as AutomationNotification["severity"] | undefined) ?? "info",
  message: raw.message ?? "",
  action_route: raw.action_route ?? "/",
});

const toAutomationInsights = (raw: AutomationInsightsRaw): AutomationInsights => ({
  plan_tier: (raw.plan_tier as PlanTier | undefined) ?? "BASIC",
  feature_flags: toPlanFeatureFlags(raw.feature_flags),
  housekeeping_sla: toHousekeepingSlaInsight(raw.housekeeping_sla),
  pricing_assistant: toPricingAssistantInsight(raw.pricing_assistant),
  exception_notifications: (raw.exception_notifications ?? []).map(
    toAutomationNotification,
  ),
});

export const getAutomationInsights = async (): Promise<AutomationInsights> => {
  const response = await apiGet<AutomationInsightsRaw>("/automations/insights");
  return toAutomationInsights(response);
};
