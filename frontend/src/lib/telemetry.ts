export type UiTelemetryEventName =
  | "dashboard_load_failed"
  | "dashboard_retry_clicked"
  | "close_cash_success"
  | "close_cash_failure";

type UiTelemetryPayload = Record<string, unknown>;

export const trackUiEvent = (event: UiTelemetryEventName, payload: UiTelemetryPayload = {}) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("hms:ui-telemetry", {
      detail: {
        event,
        payload,
        timestamp: new Date().toISOString(),
      },
    }),
  );
};
