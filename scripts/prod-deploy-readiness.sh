#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--env-file .env.prod] [--profile auto|dev|staging|prod]

Runs preflight checks before a real production deploy.
USAGE
}

ENV_FILE=".env.prod"
PROFILE="auto"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] missing command: $1" >&2; exit 1; }
}

require_file() {
  [[ -f "$1" ]] || { echo "[FAIL] missing file: $1" >&2; exit 1; }
}

require_cmd docker
require_cmd git
require_file docker-compose.yml
require_file docker-compose.prod.yml
require_file docker-compose.staging.yml
require_file scripts/validate-prod-env.sh
require_file scripts/validate-env-profile.sh
require_file scripts/deploy-with-rollback.sh
require_file scripts/check-release-ops-slo.sh
require_file scripts/check-business-kpi-runtime.sh
require_file "$ENV_FILE"

if [[ "$PROFILE" != "auto" && "$PROFILE" != "dev" && "$PROFILE" != "staging" && "$PROFILE" != "prod" ]]; then
  echo "[FAIL] --profile must be auto|dev|staging|prod" >&2
  exit 1
fi

resolve_profile() {
  if [ "$PROFILE" != "auto" ]; then
    echo "$PROFILE"
    return
  fi
  local env_value
  env_value="$(awk -F= '/^APP_ENV=/{print tolower($2)}' "$ENV_FILE" | tail -n1 | tr -d '\"' | tr -d "'" | tr -d ' ')"
  case "$env_value" in
    prod|production) echo "prod" ;;
    staging) echo "staging" ;;
    *) echo "dev" ;;
  esac
}

RUNTIME_PROFILE="$(resolve_profile)"
./scripts/validate-env-profile.sh --profile "$RUNTIME_PROFILE" --env-file "$ENV_FILE"

if [[ "$RUNTIME_PROFILE" == "prod" ]]; then
  COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.prod.yml)
elif [[ "$RUNTIME_PROFILE" == "staging" ]]; then
  COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.staging.yml)
else
  COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.yml)
fi

docker compose "${COMPOSE_ARGS[@]}" config >/tmp/hms-prod-compose.resolved.yml

echo "[INFO] computing release ops runtime metrics (CFR/rollback/MTTR)"
./scripts/check-release-ops-slo.sh \
  --events-file "${RELEASE_EVENTS_FILE:-scripts/backups/release-events.jsonl}" \
  --window-days "${RELEASE_OPS_WINDOW_DAYS:-30}" \
  --min-sample-size "${RELEASE_OPS_MIN_SAMPLE_SIZE:-10}" \
  --max-cfr-percent "${RELEASE_OPS_MAX_CFR_PERCENT:-10}" \
  --max-rollback-percent "${RELEASE_OPS_MAX_ROLLBACK_PERCENT:-5}" \
  --max-mttr-minutes "${RELEASE_OPS_MAX_MTTR_MINUTES:-30}" \
  --fail-on-threshold \
  --report /tmp/hms_release_ops_slo_readiness.md

echo "[INFO] computing business KPI runtime metrics"
./scripts/check-business-kpi-runtime.sh \
  --runner "${HMS_KPI_RUNNER:-auto}" \
  --window-hq-days "${HMS_KPI_HQ_WINDOW_DAYS:-7}" \
  --window-flags-days "${HMS_KPI_FLAGS_WINDOW_DAYS:-7}" \
  --window-upgrade-days "${HMS_KPI_UPGRADE_WINDOW_DAYS:-30}" \
  --min-hq-activation-rate "${HMS_KPI_HQ_MIN_RATE:-60}" \
  --min-feature-usage-rate "${HMS_KPI_FLAGS_MIN_RATE:-70}" \
  --min-plan-upgrade-rate "${HMS_KPI_UPGRADE_MIN_RATE:-5}" \
  --report /tmp/hms_business_kpi_runtime_readiness.md

echo "[OK] prod deploy readiness checks passed"
echo "[OK] resolved compose written: /tmp/hms-prod-compose.resolved.yml"
echo "[OK] release ops report written: /tmp/hms_release_ops_slo_readiness.md"
echo "[OK] business KPI report written: /tmp/hms_business_kpi_runtime_readiness.md"

echo "Next command:"
echo "  ./scripts/deploy-with-rollback.sh --env-file $ENV_FILE --profile $RUNTIME_PROFILE"
