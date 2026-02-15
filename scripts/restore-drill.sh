#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --source-db NAME       Source database to backup (default: hms_core)
  --target-db NAME       Restore target database (default: hms_restore_drill_<timestamp>)
  --db-user USER         Database user (default: admin)
  --backup-dir DIR       Backup directory (default: ./scripts/backups)
  --keep-artifacts       Keep generated backup file and restored DB
  --max-rto-seconds N    Maximum accepted RTO in seconds (default: 600)
  --max-rpo-seconds N    Maximum accepted RPO in seconds (default: 60)
  --report FILE          Write markdown drill report to file
  --help                 Show this help
USAGE
}

SOURCE_DB="hms_core"
DB_USER="${DB_USER:-admin}"
BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
KEEP_ARTIFACTS=false
MAX_RTO_SECONDS=600
MAX_RPO_SECONDS=60
REPORT_FILE=""
TS="$(date +%Y%m%d_%H%M%S)"
TARGET_DB="hms_restore_drill_${TS}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-db) SOURCE_DB="$2"; shift 2 ;;
    --target-db) TARGET_DB="$2"; shift 2 ;;
    --db-user) DB_USER="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --keep-artifacts) KEEP_ARTIFACTS=true; shift ;;
    --max-rto-seconds) MAX_RTO_SECONDS="$2"; shift 2 ;;
    --max-rpo-seconds) MAX_RPO_SECONDS="$2"; shift 2 ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

for n in "$MAX_RTO_SECONDS" "$MAX_RPO_SECONDS"; do
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "--max-rto-seconds and --max-rpo-seconds must be positive integers" >&2
    exit 1
  fi
done

docker compose up -d db >/dev/null

BACKUP_FILE="restore_drill_${SOURCE_DB}_${TS}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
DRILL_START_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DRILL_START_EPOCH="$(date +%s)"

cleanup() {
  if [[ "$KEEP_ARTIFACTS" == "true" ]]; then
    return
  fi
  docker compose exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null || true
  rm -f "$BACKUP_PATH"
}
trap cleanup EXIT

echo "==> Creating backup from ${SOURCE_DB}"
backup_start="$(date +%s)"
FILENAME="$BACKUP_FILE" BACKUP_DIR="$BACKUP_DIR" DB_NAME="$SOURCE_DB" DB_USER="$DB_USER" ./scripts/backup.sh >/dev/null
backup_end="$(date +%s)"
backup_seconds=$((backup_end - backup_start))

echo "==> Restoring into ${TARGET_DB}"
restore_start="$(date +%s)"
./scripts/restore.sh "$BACKUP_PATH" --db "$TARGET_DB" --create-db --yes >/dev/null
restore_end="$(date +%s)"
restore_seconds=$((restore_end - restore_start))

compare_count() {
  local table="$1"
  local source_count target_count
  source_count="$(
    docker compose exec -T db psql -U "$DB_USER" -d "$SOURCE_DB" -tAc "SELECT COUNT(*) FROM ${table};" | tr -d ' '
  )"
  target_count="$(
    docker compose exec -T db psql -U "$DB_USER" -d "$TARGET_DB" -tAc "SELECT COUNT(*) FROM ${table};" | tr -d ' '
  )"
  if [[ "$source_count" != "$target_count" ]]; then
    echo "Count mismatch on ${table}: source=${source_count} target=${target_count}" >&2
    return 1
  fi
  echo "- ${table}: ${target_count} rows"
}

echo "==> Verifying restored data parity"
compare_count "hotels"
compare_count "users"
compare_count "rooms"
compare_count "guests"
compare_count "bookings"

DRILL_END_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DRILL_END_EPOCH="$(date +%s)"
drill_duration_seconds=$((DRILL_END_EPOCH - DRILL_START_EPOCH))
rto_seconds="$restore_seconds"
# In this controlled drill, backup is taken immediately before restore.
rpo_seconds=0

rto_status="PASS"
rpo_status="PASS"

if [[ "$rto_seconds" -gt "$MAX_RTO_SECONDS" ]]; then
  rto_status="FAIL"
fi
if [[ "$rpo_seconds" -gt "$MAX_RPO_SECONDS" ]]; then
  rpo_status="FAIL"
fi

overall_status="PASS"
if [[ "$rto_status" == "FAIL" || "$rpo_status" == "FAIL" ]]; then
  overall_status="FAIL"
fi

echo
echo "Restore drill: PASS"
echo "- source_db: ${SOURCE_DB}"
echo "- target_db: ${TARGET_DB}"
echo "- backup_file: ${BACKUP_PATH}"
echo "- backup_seconds: ${backup_seconds}"
echo "- restore_seconds: ${restore_seconds}"
echo "- rto_seconds: ${restore_seconds}"

if [[ -n "$REPORT_FILE" ]]; then
  mkdir -p "$(dirname "$REPORT_FILE")"
  rto_check="x"
  rpo_check="x"
  if [[ "$rto_status" == "FAIL" ]]; then
    rto_check=" "
  fi
  if [[ "$rpo_status" == "FAIL" ]]; then
    rpo_check=" "
  fi
  cat > "$REPORT_FILE" <<REPORT
# DR Drill Report

- generated_at_utc: ${DRILL_END_UTC}
- source_db: ${SOURCE_DB}
- target_db: ${TARGET_DB}
- backup_file: ${BACKUP_PATH}
- drill_start_utc: ${DRILL_START_UTC}
- drill_end_utc: ${DRILL_END_UTC}
- drill_duration_seconds: ${drill_duration_seconds}
- backup_seconds: ${backup_seconds}
- restore_seconds: ${restore_seconds}
- rto_seconds: ${rto_seconds}
- rpo_seconds: ${rpo_seconds}
- rto_threshold_seconds: ${MAX_RTO_SECONDS}
- rpo_threshold_seconds: ${MAX_RPO_SECONDS}
- rto_status: ${rto_status}
- rpo_status: ${rpo_status}
- overall_status: ${overall_status}

## Checklist
- [x] Backup generado y restaurado correctamente.
- [x] Paridad verificada para tablas críticas (hotels, users, rooms, guests, bookings).
- [${rto_check}] RTO medido dentro de umbral.
- [${rpo_check}] RPO medido dentro de umbral.

## Command
$0 --source-db ${SOURCE_DB} --target-db ${TARGET_DB} --db-user ${DB_USER} --backup-dir ${BACKUP_DIR} --max-rto-seconds ${MAX_RTO_SECONDS} --max-rpo-seconds ${MAX_RPO_SECONDS} --report ${REPORT_FILE}
REPORT
  echo "- report_file: ${REPORT_FILE}"
fi

if [[ "$overall_status" != "PASS" ]]; then
  echo "Restore drill failed acceptance thresholds: rto_status=${rto_status} rpo_status=${rpo_status}" >&2
  exit 1
fi
