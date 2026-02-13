#!/usr/bin/env bash
# HMS Elite - Database Backup Script
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
DB_NAME="${DB_NAME:-hms_core}"
DB_USER="${DB_USER:-admin}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${FILENAME:-hms_backup_${DB_NAME}_${TIMESTAMP}.sql.gz}"
OUTPUT_PATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "🚀 Iniciando backup de la base de datos ${DB_NAME}..."

docker compose exec -T db pg_dump --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip > "$OUTPUT_PATH"

echo "✅ Backup completado con éxito: $OUTPUT_PATH"
echo "Tamaño del archivo: $(du -h "$OUTPUT_PATH" | cut -f1)"
