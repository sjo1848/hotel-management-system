import type { Capability } from "@/features/auth/capabilities";
import type { DashboardKpis } from "@/features/dashboard/services/analyticsService";
import type { CashBalance } from "@/features/dashboard/services/billingService";
import type { TenantFeatureFlags } from "@/features/dashboard/services/hotelService";

export type DashboardPrioritySource = "operations" | "automation" | "cash";

export type DashboardPrioritySeverity = "high" | "medium" | "low";

export type DashboardPriority = {
  id: string;
  source: DashboardPrioritySource;
  severity: DashboardPrioritySeverity;
  title: string;
  description: string;
  actionLabel: string;
  route?: string;
  action?: "navigate" | "close-cash";
};

export const SEVERITY_ORDER: Record<DashboardPrioritySeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const MAX_PRIORITIES = 6;

type BuildDashboardPrioritiesInput = {
  kpis: DashboardKpis | null;
  balance: CashBalance | null;
  dirtyRoomsCount: number | null;
  featureFlags: TenantFeatureFlags | null;
};

export const buildDashboardPriorities = ({
  kpis,
  balance,
  dirtyRoomsCount,
  featureFlags,
}: BuildDashboardPrioritiesInput): DashboardPriority[] => {
  if (!kpis) return [];
  const priorities: DashboardPriority[] = [];

  if (kpis.occupancy_rate < 65) {
    priorities.push({
      id: "occupancy-recovery",
      source: "operations",
      severity: "high",
      title: "Ocupación baja para hoy",
      description: "Publicar oferta de última hora y revisar disponibilidad abierta.",
      actionLabel: "Ajustar inventario",
      route: "/rooms",
    });
  }

  if (kpis.rev_par_cents > 0 && kpis.adr_cents > 0 && kpis.rev_par_cents < kpis.adr_cents * 0.6) {
    priorities.push({
      id: "revpar-gap",
      source: "operations",
      severity: "high",
      title: "RevPAR por debajo del potencial ADR",
      description: "Impulsar upsell y revisar tarifas por segmento para cerrar la brecha.",
      actionLabel: "Abrir tendencias",
      route: "/reports",
    });
  }

  if (kpis.arrivals_today.length > 0) {
    priorities.push({
      id: "arrival-readiness",
      source: "operations",
      severity: "medium",
      title: "Pre-checkin y asignación pendiente",
      description: "Priorizar las llegadas del día para reducir fricción en recepción.",
      actionLabel: "Ver reservas",
      route: "/bookings",
    });
  }

  if (kpis.departures_today.length > 0) {
    priorities.push({
      id: "checkout-turnover",
      source: "operations",
      severity: "medium",
      title: "Ventana de rotación por check-outs",
      description: "Coordinar limpieza y liberar habitaciones para venta temprana.",
      actionLabel: "Ir a limpieza",
      route: "/housekeeping",
    });
  }

  if (
    featureFlags?.automation_alerts_enabled &&
    dirtyRoomsCount !== null &&
    dirtyRoomsCount >= 3
  ) {
    priorities.push({
      id: "housekeeping-sla",
      source: "automation",
      severity: "high",
      title: "SLA housekeeping comprometido",
      description: `${dirtyRoomsCount} habitaciones sucias requieren atención para evitar pérdida de inventario.`,
      actionLabel: "Ir a limpieza",
      route: "/housekeeping",
    });
  }

  if (
    featureFlags?.automation_alerts_enabled &&
    featureFlags.pricing_assistant_enabled &&
    kpis.occupancy_rate < 65
  ) {
    priorities.push({
      id: "pricing-assistant-low-occ",
      source: "automation",
      severity: "medium",
      title: "Pricing asistido: demanda baja",
      description:
        "Revisar la tarifa base para recuperar ocupación de corto plazo dentro del rango sugerido.",
      actionLabel: "Revisar tendencias",
      route: "/reports",
    });
  }

  if (featureFlags?.automation_alerts_enabled && kpis.departures_today.length > kpis.arrivals_today.length + 2) {
    priorities.push({
      id: "inventory-gap",
      source: "automation",
      severity: "medium",
      title: "Excepción de rotación diaria",
      description: "Más salidas que llegadas en la jornada. Revisar el pipeline comercial.",
      actionLabel: "Ver reservas",
      route: "/bookings",
    });
  }

  if (balance && balance.pending_amount_cents > 0) {
    priorities.push({
      id: "cash-pending",
      source: "cash",
      severity: "medium",
      title: "Caja con cobros pendientes",
      description: "Hay saldo pendiente por cobrar en el turno actual.",
      actionLabel: "Revisar",
      route: "/bookings",
    });
  }

  return priorities
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_PRIORITIES);
};

export const SEVERITY_LABEL: Record<DashboardPrioritySeverity, string> = {
  high: "Alta",
  medium: "Media",
  low: "Informativa",
};

export const getRouteCapability = (route?: string): Capability | null => {
  switch (route) {
    case "/bookings":
    case "/calendar":
      return "bookings.read";
    case "/rooms":
      return "rooms.read";
    case "/housekeeping":
      return "housekeeping.read";
    case "/reports":
      return "reports.revenue.read";
    default:
      return null;
  }
};
