#!/bin/bash
# HMS Elite - Database Restore Script
set -e

if [ -z "$1" ]; then
    echo "❌ Error: Debes proporcionar el path al archivo de backup (.sql.gz)"
    echo "Uso: ./scripts/restore.sh ./scripts/backups/archivo.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
CONTAINER_NAME="hms-db"
DB_NAME="hms_core"
DB_USER="admin"

echo "⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual $DB_NAME."
read -p "¿Estás seguro? (s/n): " confirm
if [[ $confirm != "s" && $confirm != "S" ]]; then
    echo "Operación cancelada."
    exit 0
fi

echo "🔄 Restaurando base de datos desde $BACKUP_FILE..."

# Descomprimir y ejecutar en psql
gunzip -c "$BACKUP_FILE" | docker exec -i $CONTAINER_NAME psql -U $DB_USER $DB_NAME

echo "✅ Restauración completada con éxito."
