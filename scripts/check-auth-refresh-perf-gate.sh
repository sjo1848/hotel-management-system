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

./scripts/check-auth-refresh-slo.sh \
  --report "$REPORT_FILE" \
  --max-p95 "$MAX_P95" \
  --max-error-rate "$MAX_ERROR_RATE"
