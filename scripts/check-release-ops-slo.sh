#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --events-file PATH          JSONL release events file (default: scripts/backups/release-events.jsonl)
  --window-days N             Lookback window in days (default: 30)
  --max-cfr-percent N         change_failure_rate threshold (default: 10)
  --max-rollback-percent N    rollback_rate threshold (default: 5)
  --max-mttr-minutes N        mttr_prod threshold (default: 30)
  --min-sample-size N         minimum deploy samples to enforce CFR/rollback (default: 10)
  --fail-on-threshold         exit non-zero when thresholds fail and sample size is sufficient
  --require-data              fail when there are no deploy events in window
  --report FILE               write markdown report (default: /tmp/hms_release_ops_slo.md)
USAGE
}

EVENTS_FILE="${RELEASE_EVENTS_FILE:-scripts/backups/release-events.jsonl}"
WINDOW_DAYS=30
MAX_CFR_PERCENT=10
MAX_ROLLBACK_PERCENT=5
MAX_MTTR_MINUTES=30
MIN_SAMPLE_SIZE=10
FAIL_ON_THRESHOLD=false
REQUIRE_DATA=false
REPORT_FILE="/tmp/hms_release_ops_slo.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --events-file) EVENTS_FILE="$2"; shift 2 ;;
    --window-days) WINDOW_DAYS="$2"; shift 2 ;;
    --max-cfr-percent) MAX_CFR_PERCENT="$2"; shift 2 ;;
    --max-rollback-percent) MAX_ROLLBACK_PERCENT="$2"; shift 2 ;;
    --max-mttr-minutes) MAX_MTTR_MINUTES="$2"; shift 2 ;;
    --min-sample-size) MIN_SAMPLE_SIZE="$2"; shift 2 ;;
    --fail-on-threshold) FAIL_ON_THRESHOLD=true; shift ;;
    --require-data) REQUIRE_DATA=true; shift ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

for n in "$WINDOW_DAYS" "$MAX_CFR_PERCENT" "$MAX_ROLLBACK_PERCENT" "$MAX_MTTR_MINUTES" "$MIN_SAMPLE_SIZE"; do
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "Numeric option expected integer; got: $n" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$REPORT_FILE")"

python_output="$(
python3 - <<'PY' "$EVENTS_FILE" "$WINDOW_DAYS" "$MAX_CFR_PERCENT" "$MAX_ROLLBACK_PERCENT" "$MAX_MTTR_MINUTES" "$MIN_SAMPLE_SIZE"
import json
import os
import sys
from datetime import datetime, timezone, timedelta

events_file = sys.argv[1]
window_days = int(sys.argv[2])
max_cfr = float(sys.argv[3])
max_rollback = float(sys.argv[4])
max_mttr = float(sys.argv[5])
min_samples = int(sys.argv[6])

now = datetime.now(timezone.utc)
window_start = now - timedelta(days=window_days)

events = []
if os.path.exists(events_file):
    with open(events_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue
            ts = evt.get("timestamp_utc")
            if not ts:
                continue
            try:
                dt = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if dt >= window_start:
                evt["_ts"] = dt
                events.append(evt)

deploy_events = [e for e in events if e.get("event_type") == "deploy"]
total_deploys = len(deploy_events)
failed_deploys = sum(1 for e in deploy_events if str(e.get("status", "")).lower() == "failure")
rollbacks = sum(1 for e in deploy_events if bool(e.get("rollback_executed", False)))

cfr = (failed_deploys / total_deploys * 100.0) if total_deploys else 0.0
rollback_rate = (rollbacks / total_deploys * 100.0) if total_deploys else 0.0

recovery_samples = []
for e in deploy_events:
    recovery_seconds = e.get("recovery_seconds")
    if recovery_seconds is None:
        continue
    try:
        recovery_samples.append(float(recovery_seconds))
    except (TypeError, ValueError):
        continue

if recovery_samples:
    mttr_minutes = sum(recovery_samples) / len(recovery_samples) / 60.0
else:
    mttr_minutes = 0.0

enough_samples = total_deploys >= min_samples
data_available = total_deploys > 0

cfr_status = "PASS" if (not enough_samples or cfr <= max_cfr) else "FAIL"
rollback_status = "PASS" if (not enough_samples or rollback_rate <= max_rollback) else "FAIL"
mttr_status = "PASS" if (not recovery_samples or mttr_minutes <= max_mttr) else "FAIL"

overall = "PASS"
if enough_samples and (cfr_status == "FAIL" or rollback_status == "FAIL"):
    overall = "FAIL"
if mttr_status == "FAIL":
    overall = "FAIL"

latest_ts = max((e["_ts"] for e in events), default=None)

print(f"TOTAL_DEPLOYS={total_deploys}")
print(f"FAILED_DEPLOYS={failed_deploys}")
print(f"ROLLBACKS={rollbacks}")
print(f"CFR_PERCENT={cfr:.2f}")
print(f"ROLLBACK_PERCENT={rollback_rate:.2f}")
print(f"MTTR_MINUTES={mttr_minutes:.2f}")
print(f"RECOVERY_SAMPLES={len(recovery_samples)}")
print(f"ENOUGH_SAMPLES={'true' if enough_samples else 'false'}")
print(f"DATA_AVAILABLE={'true' if data_available else 'false'}")
print(f"LATEST_EVENT_UTC={latest_ts.strftime('%Y-%m-%dT%H:%M:%SZ') if latest_ts else ''}")
print(f"CFR_STATUS={cfr_status}")
print(f"ROLLBACK_STATUS={rollback_status}")
print(f"MTTR_STATUS={mttr_status}")
print(f"OVERALL_STATUS={overall}")
PY
)"

eval "$python_output"

{
  echo "# Release Ops SLO Runtime Report"
  echo
  echo "- generated_at_utc: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- events_file: $EVENTS_FILE"
  echo "- window_days: $WINDOW_DAYS"
  echo "- latest_event_utc: ${LATEST_EVENT_UTC:-}"
  echo
  echo "## Metrics"
  echo
  echo "- total_deploys: $TOTAL_DEPLOYS"
  echo "- failed_deploys: $FAILED_DEPLOYS"
  echo "- rollbacks: $ROLLBACKS"
  echo "- change_failure_rate_percent: $CFR_PERCENT"
  echo "- rollback_rate_percent: $ROLLBACK_PERCENT"
  echo "- mttr_prod_minutes: $MTTR_MINUTES"
  echo "- recovery_samples: $RECOVERY_SAMPLES"
  echo "- enough_samples: $ENOUGH_SAMPLES (min=$MIN_SAMPLE_SIZE)"
  echo
  echo "## Thresholds"
  echo
  echo "- max_change_failure_rate_percent: $MAX_CFR_PERCENT"
  echo "- max_rollback_rate_percent: $MAX_ROLLBACK_PERCENT"
  echo "- max_mttr_minutes: $MAX_MTTR_MINUTES"
  echo
  echo "## Evaluation"
  echo
  echo "- cfr_status: $CFR_STATUS"
  echo "- rollback_status: $ROLLBACK_STATUS"
  echo "- mttr_status: $MTTR_STATUS"
  echo "- overall_status: $OVERALL_STATUS"
} > "$REPORT_FILE"

cat "$REPORT_FILE"
echo
echo "Report written to: $REPORT_FILE"

if [[ "$DATA_AVAILABLE" != "true" ]]; then
  if [[ "$REQUIRE_DATA" == "true" ]]; then
    echo "release-ops-slo-check: FAIL (no deploy events in window)" >&2
    exit 1
  fi
  echo "release-ops-slo-check: PASS (no data yet; enforcement deferred)"
  exit 0
fi

if [[ "$FAIL_ON_THRESHOLD" == "true" && "$OVERALL_STATUS" != "PASS" ]]; then
  echo "release-ops-slo-check: FAIL (threshold breach)" >&2
  exit 1
fi

echo "release-ops-slo-check: PASS"
