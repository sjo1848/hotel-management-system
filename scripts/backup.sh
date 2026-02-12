#!/bin/bash
# HMS Elite - Database Backup Script
set -e

# Configuración
BACKUP_DIR="./scripts/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="hms_backup_$TIMESTAMP.sql.gz"
CONTAINER_NAME="hms-db"
DB_NAME="hms_core"
DB_USER="admin"

echo "🚀 Iniciando backup de la base de datos $DB_NAME..."

# Ejecutar pg_dump dentro del contenedor y comprimir
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/$FILENAME"

echo "✅ Backup completado con éxito: $BACKUP_DIR/$FILENAME"
echo "Tamaño del archivo: $(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)"
