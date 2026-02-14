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
  --help                 Show this help
USAGE
}

SOURCE_DB="hms_core"
DB_USER="${DB_USER:-admin}"
BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
KEEP_ARTIFACTS=false
TS="$(date +%Y%m%d_%H%M%S)"
TARGET_DB="hms_restore_drill_${TS}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-db) SOURCE_DB="$2"; shift 2 ;;
    --target-db) TARGET_DB="$2"; shift 2 ;;
    --db-user) DB_USER="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --keep-artifacts) KEEP_ARTIFACTS=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

docker compose up -d db >/dev/null

BACKUP_FILE="restore_drill_${SOURCE_DB}_${TS}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

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

echo
echo "Restore drill: PASS"
echo "- source_db: ${SOURCE_DB}"
echo "- target_db: ${TARGET_DB}"
echo "- backup_file: ${BACKUP_PATH}"
echo "- backup_seconds: ${backup_seconds}"
echo "- restore_seconds: ${restore_seconds}"
echo "- rto_seconds: ${restore_seconds}"

