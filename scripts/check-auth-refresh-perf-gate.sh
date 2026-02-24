#!/usr/bin/env bash
set -euo pipefail

REPORT_FILE="/tmp/hms_perf_gate_ci.md"
MAX_P95="0.25"
MAX_ERROR_RATE="0.005"

usage() {
  cat <<USAGE
Usage: $0 [--report FILE] [--max-p95 SEC] [--max-error-rate RATE]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --report)
      REPORT_FILE="$2"
      shift 2
      ;;
    --max-p95)
      MAX_P95="$2"
      shift 2
      ;;
    --max-error-rate)
      MAX_ERROR_RATE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$REPORT_FILE" ]]; then
  echo "auth-refresh-perf-gate: FAIL (missing report: $REPORT_FILE)" >&2
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
  echo "auth-refresh-perf-gate: FAIL (auth_refresh row not found in $REPORT_FILE)" >&2
  exit 1
fi

IFS='|' read -r endpoint n avg p50 p95 p99 error_rate status_p95 status_error <<<"$row"

if [[ "$status_p95" != "PASS" || "$status_error" != "PASS" ]]; then
  echo "auth-refresh-perf-gate: FAIL (perf report already marks auth_refresh as failed)" >&2
  echo "  status_p95=$status_p95 status_error_rate=$status_error" >&2
  exit 1
fi

if ! awk -v v="$p95" -v max="$MAX_P95" 'BEGIN { exit (v <= max) ? 0 : 1 }'; then
  echo "auth-refresh-perf-gate: FAIL (p95_auth_refresh=$p95 exceeds $MAX_P95)" >&2
  exit 1
fi

if ! awk -v v="$error_rate" -v max="$MAX_ERROR_RATE" 'BEGIN { exit (v <= max) ? 0 : 1 }'; then
  echo "auth-refresh-perf-gate: FAIL (auth_refresh_error_rate=$error_rate exceeds $MAX_ERROR_RATE)" >&2
  exit 1
fi

echo "auth-refresh-perf-gate: PASS (p95=$p95, error_rate=$error_rate, threshold_p95=$MAX_P95, threshold_error_rate=$MAX_ERROR_RATE)"
