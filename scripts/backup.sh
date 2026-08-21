#!/usr/bin/env bash
# HMS Elite - Database Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
DB_NAME="${DB_NAME:-hms_core}"
DB_USER="${DB_USER:-}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${FILENAME:-hms_backup_${DB_NAME}_${TIMESTAMP}.sql.gz}"
OUTPUT_PATH="${BACKUP_DIR}/${FILENAME}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-35}"
BACKUP_COMPOSE_FILE="${BACKUP_COMPOSE_FILE:-${COMPOSE_FILE:-docker-compose.yml}}"
BACKUP_DATABASE_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "$BACKUP_DATABASE_URL" && "${APP_ENV:-dev}" =~ ^(dev|development|local)$ ]]; then
  DB_USER="${DB_USER:-admin}"
fi

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo "BACKUP_RETENTION_DAYS must be numeric" >&2; exit 1; }
if [[ "${APP_ENV:-dev}" =~ ^(prod|production|staging)$ && "${ALLOW_DATABASE_OPERATIONS:-}" != true ]]; then
  echo "Refusing non-local backup without ALLOW_DATABASE_OPERATIONS=true" >&2
  exit 1
fi
if [[ "${APP_ENV:-dev}" =~ ^(prod|production)$ ]]; then
  [[ -n "${BACKUP_ENCRYPT_COMMAND:-}" ]] || { echo "BACKUP_ENCRYPT_COMMAND is required in production" >&2; exit 1; }
  [[ -n "${BACKUP_OFFSITE_COMMAND:-}" ]] || { echo "BACKUP_OFFSITE_COMMAND is required in production" >&2; exit 1; }
fi

umask 077
mkdir -p "$BACKUP_DIR"
if [[ -z "$BACKUP_DATABASE_URL" ]]; then
  [[ "${APP_ENV:-dev}" =~ ^(dev|development|local)$ ]] || { echo "A PostgreSQL URL is required outside dev" >&2; exit 1; }
  [[ -n "$DB_USER" ]] || { echo "DB_USER is required for docker fallback" >&2; exit 1; }
  command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
  [[ -f "$BACKUP_COMPOSE_FILE" ]] || { echo "Backup compose file not found: $BACKUP_COMPOSE_FILE" >&2; exit 1; }
  BACKUP_COMPOSE_ARGS=(-f "$BACKUP_COMPOSE_FILE")
  if [[ -f "${ENV_FILE:-.env}" ]]; then
    BACKUP_COMPOSE_ARGS+=(--env-file "${ENV_FILE:-.env}")
  fi
fi

echo "🚀 Iniciando backup de la base de datos ${DB_NAME}..."

if [[ -n "$BACKUP_DATABASE_URL" ]]; then
  pg_dump "$BACKUP_DATABASE_URL" --clean --if-exists --no-owner --no-privileges | gzip > "$OUTPUT_PATH"
else
  docker compose "${BACKUP_COMPOSE_ARGS[@]}" exec -T db pg_dump --clean --if-exists --no-owner --no-privileges -U "$DB_USER" "$DB_NAME" | gzip > "$OUTPUT_PATH"
fi
sha256sum "$OUTPUT_PATH" > "${OUTPUT_PATH}.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hms_backup_*.sql.gz*' -mtime "+$RETENTION_DAYS" -delete

if [[ -n "${BACKUP_ENCRYPT_COMMAND:-}" ]]; then
  BACKUP_INPUT="$OUTPUT_PATH" BACKUP_OUTPUT="${OUTPUT_PATH}.enc" bash -c "$BACKUP_ENCRYPT_COMMAND"
  [[ -s "${OUTPUT_PATH}.enc" ]] || { echo "Encryption produced no artifact" >&2; exit 1; }
  rm -f "$OUTPUT_PATH" "${OUTPUT_PATH}.sha256"
  sha256sum "${OUTPUT_PATH}.enc" > "${OUTPUT_PATH}.enc.sha256"
  OUTPUT_PATH="${OUTPUT_PATH}.enc"
fi
if [[ -n "${BACKUP_OFFSITE_COMMAND:-}" ]]; then
  BACKUP_INPUT="$OUTPUT_PATH" bash -c "$BACKUP_OFFSITE_COMMAND"
fi

echo "✅ Backup completado con éxito: $OUTPUT_PATH"
echo "Retention: ${RETENTION_DAYS} days; checksum and optional encryption/off-host hooks completed"
