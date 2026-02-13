export type UiTelemetryEventName =
  | "dashboard_load_failed"
  | "dashboard_retry_clicked"
  | "close_cash_success"
  | "close_cash_failure";

type UiTelemetryPayload = Record<string, unknown>;

type UiTelemetryEnvelope = {
  event: UiTelemetryEventName;
  payload: UiTelemetryPayload;
  timestamp: string;
};

const getCookie = (name: string): string | null => {
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  return match ? match.substring(name.length + 1) : null;
};

const sendUiTelemetry = async (envelope: UiTelemetryEnvelope) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCookie("csrf_token");
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  await fetch("/api/v1/telemetry/ui", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers,
    body: JSON.stringify(envelope),
  });
};

export const trackUiEvent = (event: UiTelemetryEventName, payload: UiTelemetryPayload = {}) => {
  if (typeof window === "undefined") return;
  const envelope: UiTelemetryEnvelope = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent("hms:ui-telemetry", {
      detail: envelope,
    }),
  );

  void sendUiTelemetry(envelope).catch(() => {
    // Best-effort telemetry: no impact on UX flow.
  });
};
