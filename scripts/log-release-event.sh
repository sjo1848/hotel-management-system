#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --event TYPE --status STATUS [--file PATH] [--field key=value]...

Appends one JSONL event for release operations metrics.
USAGE
}

EVENT_TYPE=""
STATUS=""
EVENT_FILE="${RELEASE_EVENTS_FILE:-scripts/backups/release-events.jsonl}"
FIELDS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --event)
      EVENT_TYPE="$2"
      shift 2
      ;;
    --status)
      STATUS="$2"
      shift 2
      ;;
    --file)
      EVENT_FILE="$2"
      shift 2
      ;;
    --field)
      FIELDS+=("$2")
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

if [[ -z "$EVENT_TYPE" || -z "$STATUS" ]]; then
  echo "--event and --status are required." >&2
  usage
  exit 1
fi

for kv in "${FIELDS[@]}"; do
  if [[ "$kv" != *=* ]]; then
    echo "Invalid --field format (expected key=value): $kv" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$EVENT_FILE")"

tmp_fields_file="$(mktemp)"
cleanup() {
  rm -f "$tmp_fields_file"
}
trap cleanup EXIT
printf "%s\n" "${FIELDS[@]}" > "$tmp_fields_file"

python3 - <<'PY' "$EVENT_TYPE" "$STATUS" "$EVENT_FILE" "$tmp_fields_file"
import json
import sys
from datetime import datetime, timezone

event_type = sys.argv[1]
status = sys.argv[2]
event_file = sys.argv[3]
fields_path = sys.argv[4]

def parse_value(raw: str):
    v = raw.strip()
    if v.lower() == "true":
        return True
    if v.lower() == "false":
        return False
    if v.lower() == "null":
        return None
    try:
        if "." in v:
            return float(v)
        return int(v)
    except ValueError:
        return v

event = {
    "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "event_type": event_type,
    "status": status,
}

with open(fields_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        k, v = line.split("=", 1)
        event[k] = parse_value(v)

with open(event_file, "a", encoding="utf-8") as out:
    out.write(json.dumps(event, ensure_ascii=True) + "\n")
PY

echo "release-event: logged type=${EVENT_TYPE} status=${STATUS} file=${EVENT_FILE}"
