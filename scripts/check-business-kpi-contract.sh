#!/usr/bin/env bash
set -euo pipefail

DOC_CONTRACT="docs/validation/ops-kpi-contract.md"
FRONTEND_TELEMETRY="frontend/src/lib/telemetry.ts"
BACKEND_TELEMETRY="backend/src/infrastructure/web/handlers/reporting.rs"
OPENAPI_FILE="backend/openapi.yaml"

for file in "$DOC_CONTRACT" "$FRONTEND_TELEMETRY" "$BACKEND_TELEMETRY" "$OPENAPI_FILE"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

extract_section() {
  local marker="$1"
  awk -v marker="$marker" '
    $0 == marker { in_block=1; next }
    in_block && /^### / { exit }
    in_block { print }
  ' "$DOC_CONTRACT"
}

check_kpi_block() {
  local marker="$1"
  local block
  block="$(extract_section "$marker")"
  if [[ -z "$block" ]]; then
    echo "Missing KPI section in contract: $marker" >&2
    exit 1
  fi
  for token in "- Formula:" "- Source:" "- Window:" "- Threshold:" "- Validation command:" "- Owner:"; do
    if ! grep -Fq -- "$token" <<<"$block"; then
      echo "KPI section missing token '$token': $marker" >&2
      exit 1
    fi
  done
}

check_kpi_block "### B1. kpi_hq_activation_rate"
check_kpi_block "### B2. kpi_feature_flags_usage_rate"
check_kpi_block "### B3. kpi_plan_upgrade_rate"
check_kpi_block "### B4. kpi_critical_task_time_p95"
check_kpi_block "### B5. kpi_churn_proxy_4w"

required_events=(
  "revenue_cockpit_viewed"
  "revenue_cockpit_cta_clicked"
  "automation_alert_clicked"
  "network_kpis_viewed"
  "network_plan_upgrade_submitted"
  "network_plan_upgrade_succeeded"
  "network_plan_upgrade_failed"
)

for event_name in "${required_events[@]}"; do
  if ! grep -Fq "$event_name" "$DOC_CONTRACT"; then
    echo "Business KPI contract missing event: $event_name" >&2
    exit 1
  fi
  if ! grep -Fq "\"$event_name\"" "$FRONTEND_TELEMETRY"; then
    echo "Frontend telemetry union missing event: $event_name" >&2
    exit 1
  fi
  if ! grep -Fq "\"$event_name\"" "$BACKEND_TELEMETRY"; then
    echo "Backend telemetry allowlist missing event: $event_name" >&2
    exit 1
  fi
  if ! grep -Fq -- "- $event_name" "$OPENAPI_FILE"; then
    echo "OpenAPI telemetry enum missing event: $event_name" >&2
    exit 1
  fi
done

echo "business-kpi-contract-check: PASS"
