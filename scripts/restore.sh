#!/usr/bin/env bash
# Destructive database restore; provider-neutral and explicitly gated.
set -euo pipefail
usage() { echo "Usage: restore.sh <backup.sql.gz> [--db NAME] [--create-db] [--recreate-db] [--yes]"; }
[[ $# -ge 1 ]] || { usage; exit 1; }
BACKUP_FILE="$1"; shift; DB_NAME=hms_core; DB_USER="${DB_USER:-}"; CREATE_DB=false; RECREATE_DB=false; ASSUME_YES=false
CONNECTION_URL="${RESTORE_DATABASE_URL:-${DATABASE_URL:-${BACKUP_DATABASE_URL:-}}}"; SOURCE_URL="${RESTORE_SOURCE_DATABASE_URL:-${SOURCE_DATABASE_URL:-${BACKUP_DATABASE_URL:-}}}"; ADMIN_URL="${RESTORE_DATABASE_ADMIN_URL:-${DATABASE_ADMIN_URL:-}}"
if [[ -z "$CONNECTION_URL" && "${APP_ENV:-dev}" =~ ^(dev|development|local)$ ]]; then DB_USER="${DB_USER:-admin}"; fi
while [[ $# -gt 0 ]]; do case "$1" in --db) DB_NAME="$2"; shift 2;; --create-db) CREATE_DB=true; shift;; --recreate-db) RECREATE_DB=true; shift;; --yes) ASSUME_YES=true; shift;; *) usage; exit 1;; esac; done
[[ -f "$BACKUP_FILE" ]] || { echo "Backup not found: $BACKUP_FILE" >&2; exit 1; }; [[ "$DB_NAME" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid DB_NAME" >&2; exit 1; }
if [[ "${APP_ENV:-dev}" =~ ^(prod|production)$ ]]; then
  [[ "${ALLOW_DATABASE_OPERATIONS:-}" == true ]] || { echo "Set ALLOW_DATABASE_OPERATIONS=true" >&2; exit 1; }
  [[ "${MAINTENANCE_MODE:-}" == true ]] || { echo "Production restore requires MAINTENANCE_MODE=true" >&2; exit 1; }
fi
if [[ "$RECREATE_DB" == true ]]; then [[ "${MAINTENANCE_MODE:-}" == true && "$ASSUME_YES" == true ]] || { echo "Destructive restore requires MAINTENANCE_MODE=true and --yes" >&2; exit 1; }; fi
if [[ "${APP_ENV:-dev}" =~ ^(prod|production)$ && -n "$CONNECTION_URL" && -n "$SOURCE_URL" && "$CONNECTION_URL" == "$SOURCE_URL" ]]; then
  echo "Production restore rejected: source and target PostgreSQL URLs are identical" >&2
  exit 1
fi
if [[ -n "$CONNECTION_URL" ]]; then
  command -v psql >/dev/null || { echo "psql is required for URL restore" >&2; exit 1; }
  if [[ "$CREATE_DB" == true || "$RECREATE_DB" == true ]]; then [[ -n "$ADMIN_URL" ]] || { echo "RESTORE_DATABASE_ADMIN_URL or DATABASE_ADMIN_URL is required for URL database DDL" >&2; exit 1; }; fi
else
  [[ "${APP_ENV:-dev}" =~ ^(dev|development|local)$ ]] || { echo "A PostgreSQL URL is required outside dev" >&2; exit 1; }
  [[ -n "$DB_USER" ]] || { echo "DB_USER is required for docker fallback" >&2; exit 1; }; command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
fi
if [[ "$ASSUME_YES" != true ]]; then read -r -p "Restore over ${DB_NAME}? type RESTORE: " answer; [[ "$answer" == RESTORE ]] || exit 0; fi
umask 077
RESTORE_ARCHIVE="$BACKUP_FILE"
DECRYPTED_ARCHIVE=""
cleanup_plaintext() { [[ -z "$DECRYPTED_ARCHIVE" ]] || rm -f -- "$DECRYPTED_ARCHIVE"; }
trap cleanup_plaintext EXIT
if [[ "$BACKUP_FILE" == *.enc ]]; then
  [[ -n "${BACKUP_DECRYPT_COMMAND:-}" ]] || { echo "Encrypted backup requires BACKUP_DECRYPT_COMMAND" >&2; exit 1; }
  DECRYPTED_ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/hms-restore.XXXXXX.sql.gz")"
  BACKUP_INPUT="$BACKUP_FILE" BACKUP_OUTPUT="$DECRYPTED_ARCHIVE" bash -c "$BACKUP_DECRYPT_COMMAND"
  [[ -s "$DECRYPTED_ARCHIVE" ]] || { echo "Decrypt command produced no plaintext archive" >&2; exit 1; }
  RESTORE_ARCHIVE="$DECRYPTED_ARCHIVE"
fi
if [[ -n "$CONNECTION_URL" ]]; then
  if [[ "$CREATE_DB" == true ]]; then
    database_exists="$(psql "$ADMIN_URL" -tAqc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='${DB_NAME}');")"
    if [[ "$database_exists" != "t" ]]; then
      createdb --maintenance-db="$ADMIN_URL" "$DB_NAME"
    fi
  fi
  if [[ "$RECREATE_DB" == true ]]; then psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null; dropdb --if-exists --maintenance-db="$ADMIN_URL" "$DB_NAME"; createdb --maintenance-db="$ADMIN_URL" "$DB_NAME"; fi
  gunzip -c "$RESTORE_ARCHIVE" | psql "$CONNECTION_URL" -v ON_ERROR_STOP=1
else
  if [[ "$CREATE_DB" == true ]]; then docker compose -f "${RESTORE_COMPOSE_FILE:-docker-compose.yml}" exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "SELECT 'CREATE DATABASE ${DB_NAME}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='${DB_NAME}')\\gexec"; fi
  if [[ "$RECREATE_DB" == true ]]; then docker compose -f "${RESTORE_COMPOSE_FILE:-docker-compose.yml}" exec -T db psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null; docker compose -f "${RESTORE_COMPOSE_FILE:-docker-compose.yml}" exec -T db dropdb --if-exists -U "$DB_USER" "$DB_NAME"; docker compose -f "${RESTORE_COMPOSE_FILE:-docker-compose.yml}" exec -T db createdb -U "$DB_USER" "$DB_NAME"; fi
  gunzip -c "$RESTORE_ARCHIVE" | docker compose -f "${RESTORE_COMPOSE_FILE:-docker-compose.yml}" exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$DB_NAME"
fi
SMOKE_DATABASE_URL="$CONNECTION_URL" DATABASE_URL="$CONNECTION_URL" ./scripts/production-smoke.sh --db "$DB_NAME" --db-user "$DB_USER"; echo "Restore complete: $DB_NAME"
