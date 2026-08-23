#!/usr/bin/env bash
set -euo pipefail

DOC="docs/validation/ops-kpi-contract.md"
REPORT_FILE=""
MAX_P95="0.25"
MAX_ERROR_RATE="0.005"
REQUIRE_RUNTIME=0

usage() {
  cat <<USAGE
Usage: $0 [--report FILE] [--max-p95 SEC] [--max-error-rate RATE] [--require-runtime]

Validates:
  1) auth refresh SLOs in docs/validation/ops-kpi-contract.md
  2) optional runtime SLO evidence from a perf report
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --report) REPORT_FILE="$2"; shift 2 ;;
    --max-p95) MAX_P95="$2"; shift 2 ;;
    --max-error-rate) MAX_ERROR_RATE="$2"; shift 2 ;;
    --require-runtime) REQUIRE_RUNTIME=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -f "$DOC" ]]; then
  echo "Missing $DOC" >&2
  exit 1
fi

required_lines=(
  'auth_refresh_error_rate < 0.5%'
  'p95_auth_refresh < 250ms'
  'refresh_retry_success_rate >= 99.5%'
)

for line in "${required_lines[@]}"; do
  if ! grep -Fq "$line" "$DOC"; then
    echo "SLO contract missing line: $line" >&2
    echo "auth-refresh-slo-check: FAIL" >&2
    exit 1
  fi
done

if [[ -z "$REPORT_FILE" ]]; then
  if [[ "$REQUIRE_RUNTIME" == "1" ]]; then
    echo "auth-refresh-slo-check: FAIL (runtime report required but not provided)" >&2
    exit 1
  fi
  echo "auth-refresh-slo-check: PASS (contract)"
  exit 0
fi

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "auth-refresh-slo-check: FAIL (missing report: $REPORT_FILE)" >&2
  exit 1
fi

row="$(
  awk -F'|' '
    /^\| auth_refresh / {
      endpoint=$2; gsub(/^[ \t]+|[ \t]+$/, "", endpoint)
      n=$3; gsub(/^[ \t]+|[ \t]+$/, "", n)
      avg=$4; gsub(/^[ \t]+|[ \t]+$/, "", avg)
      p50=$5; gsub(/^[ \t]+|[ \t]+$/, "", p50)
      p95=$6; gsub(/^[ \t]+|[ \t]+$/, "", p95)
      p99=$7; gsub(/^[ \t]+|[ \t]+$/, "", p99)
      err=$8; gsub(/^[ \t]+|[ \t]+$/, "", err)
      status_p95=$12; gsub(/^[ \t]+|[ \t]+$/, "", status_p95)
      status_err=$13; gsub(/^[ \t]+|[ \t]+$/, "", status_err)
      print endpoint "|" n "|" avg "|" p50 "|" p95 "|" p99 "|" err "|" status_p95 "|" status_err
    }
  ' "$REPORT_FILE"
)"

if [[ -z "$row" ]]; then
  echo "auth-refresh-slo-check: FAIL (auth_refresh row not found in $REPORT_FILE)" >&2
  exit 1
fi

IFS='|' read -r endpoint n avg p50 p95 p99 error_rate status_p95 status_error <<<"$row"

if [[ "$status_p95" != "PASS" || "$status_error" != "PASS" ]]; then
  echo "auth-refresh-slo-check: FAIL (perf report marks auth_refresh as failed)" >&2
  echo "  status_p95=$status_p95 status_error_rate=$status_error" >&2
  exit 1
fi

if ! awk -v v="$p95" -v max="$MAX_P95" 'BEGIN { exit (v <= max) ? 0 : 1 }'; then
  echo "auth-refresh-slo-check: FAIL (p95_auth_refresh=$p95 exceeds $MAX_P95)" >&2
  exit 1
fi

if ! awk -v v="$error_rate" -v max="$MAX_ERROR_RATE" 'BEGIN { exit (v <= max) ? 0 : 1 }'; then
  echo "auth-refresh-slo-check: FAIL (auth_refresh_error_rate=$error_rate exceeds $MAX_ERROR_RATE)" >&2
  exit 1
fi

echo "auth-refresh-slo-check: PASS (contract + runtime, p95=$p95, error_rate=$error_rate)"
