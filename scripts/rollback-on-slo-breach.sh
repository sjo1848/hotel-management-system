#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --env-file PATH            Env file for deploy rollback command (default: .env)
  --profile MODE             auto|dev|staging|prod (default: auto)
  --target-ref REF           Git ref to rollback/deploy to when breach is detected (default: HEAD~1)
  --base-url URL             Base URL for perf baseline (default: http://localhost:3001)
  --requests N               Requests per endpoint for perf baseline (default: 8)
  --concurrency N            Parallel workers for perf baseline (default: 2)
  --warmup N                 Warmup requests per endpoint (default: 1)
  --slo-p95-sec SEC          P95 SLO threshold in seconds (default: 1.0)
  --slo-error-rate RATE      Error-rate SLO threshold (default: 0.05)
  --simulate-breach          Force breach path without relying on perf results
  --skip-perf-check          Skip perf baseline execution (use with --simulate-breach)
  --execute-rollback         Execute deploy/rollback workflow when breach is detected
  --fail-on-breach           Exit non-zero when breach is detected (even if rollback succeeds)
  --skip-deploy-tests        Forward --skip-tests to deploy-with-rollback
  --report FILE              Write markdown report (default: /tmp/hms_rollback_on_slo.md)
  -h, --help                 Show this help
USAGE
}

ENV_FILE=".env"
PROFILE="auto"
TARGET_REF="HEAD~1"
BASE_URL="http://localhost:3001"
REQUESTS=8
CONCURRENCY=2
WARMUP=1
SLO_P95_SEC="1.0"
SLO_ERROR_RATE="0.05"
SIMULATE_BREACH=false
SKIP_PERF_CHECK=false
EXECUTE_ROLLBACK=false
FAIL_ON_BREACH=false
SKIP_DEPLOY_TESTS=false
REPORT_FILE="/tmp/hms_rollback_on_slo.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --target-ref) TARGET_REF="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --requests) REQUESTS="$2"; shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
    --warmup) WARMUP="$2"; shift 2 ;;
    --slo-p95-sec) SLO_P95_SEC="$2"; shift 2 ;;
    --slo-error-rate) SLO_ERROR_RATE="$2"; shift 2 ;;
    --simulate-breach) SIMULATE_BREACH=true; shift ;;
    --skip-perf-check) SKIP_PERF_CHECK=true; shift ;;
    --execute-rollback) EXECUTE_ROLLBACK=true; shift ;;
    --fail-on-breach) FAIL_ON_BREACH=true; shift ;;
    --skip-deploy-tests) SKIP_DEPLOY_TESTS=true; shift ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$PROFILE" != "auto" && "$PROFILE" != "dev" && "$PROFILE" != "staging" && "$PROFILE" != "prod" ]]; then
  echo "--profile must be auto|dev|staging|prod" >&2
  exit 1
fi

for n in "$REQUESTS" "$CONCURRENCY" "$WARMUP"; do
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "requests/concurrency/warmup must be integers" >&2
    exit 1
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

run_id="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
perf_report="$(mktemp)"
perf_log="$(mktemp)"
cleanup() {
  rm -f "$perf_report" "$perf_log"
}
trap cleanup EXIT

perf_failed=false
breach_detected=false
rollback_result="not_triggered"
action_mode="dry-run"

if [[ "$SKIP_PERF_CHECK" != "true" ]]; then
  set +e
  ./scripts/perf-baseline.sh \
    --base-url "$BASE_URL" \
    --requests "$REQUESTS" \
    --concurrency "$CONCURRENCY" \
    --warmup "$WARMUP" \
    --slo-p95-sec "$SLO_P95_SEC" \
    --slo-error-rate "$SLO_ERROR_RATE" \
    --fail-on-slo \
    --report "$perf_report" >"$perf_log" 2>&1
  perf_status=$?
  set -e

  if [[ "$perf_status" -ne 0 ]]; then
    perf_failed=true
    if grep -q "Performance SLO gate failed" "$perf_log"; then
      breach_detected=true
    else
      echo "Perf baseline failed for a non-SLO reason. Aborting rollback automation." >&2
      cat "$perf_log" >&2
      exit 1
    fi
  fi
else
  echo "Perf baseline skipped (--skip-perf-check)." >"$perf_log"
fi

if [[ "$SIMULATE_BREACH" == "true" ]]; then
  breach_detected=true
fi

if [[ "$breach_detected" == "true" ]]; then
  if [[ "$EXECUTE_ROLLBACK" == "true" ]]; then
    action_mode="execute"
    rollback_cmd=(./scripts/deploy-with-rollback.sh --target-ref "$TARGET_REF" --env-file "$ENV_FILE" --profile "$PROFILE")
    if [[ "$SKIP_DEPLOY_TESTS" == "true" ]]; then
      rollback_cmd+=(--skip-tests)
    fi
    if "${rollback_cmd[@]}"; then
      rollback_result="executed_success"
    else
      rollback_result="executed_failed"
      echo "Rollback execution failed." >&2
      exit 1
    fi
  else
    rollback_result="would_execute"
  fi
fi

mkdir -p "$(dirname "$REPORT_FILE")"
{
  echo "# Rollback on SLO Breach"
  echo
  echo "- generated_at_utc: $run_id"
  echo "- env_file: $ENV_FILE"
  echo "- profile: $PROFILE"
  echo "- target_ref: $TARGET_REF"
  echo "- base_url: $BASE_URL"
  echo "- requests: $REQUESTS"
  echo "- concurrency: $CONCURRENCY"
  echo "- warmup: $WARMUP"
  echo "- slo_p95_sec: $SLO_P95_SEC"
  echo "- slo_error_rate: $SLO_ERROR_RATE"
  echo "- simulate_breach: $SIMULATE_BREACH"
  echo "- skip_perf_check: $SKIP_PERF_CHECK"
  echo "- fail_on_breach: $FAIL_ON_BREACH"
  echo "- perf_failed: $perf_failed"
  echo "- breach_detected: $breach_detected"
  echo "- action_mode: $action_mode"
  echo "- rollback_result: $rollback_result"
  echo
  echo "## Perf Baseline Output"
  echo
  cat "$perf_log"
} >"$REPORT_FILE"

cat "$REPORT_FILE"
echo
echo "Report written to: $REPORT_FILE"

if [[ "$breach_detected" == "true" && "$rollback_result" == "would_execute" ]]; then
  echo "SLO breach detected. Dry-run mode active; rollback command not executed."
fi

if [[ "$breach_detected" == "true" && "$FAIL_ON_BREACH" == "true" ]]; then
  echo "SLO breach detected and fail-on-breach is enabled." >&2
  exit 2
fi

echo "Rollback-on-SLO flow completed."
