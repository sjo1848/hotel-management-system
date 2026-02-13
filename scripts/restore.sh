#!/usr/bin/env bash
# HMS Elite - Database Restore Script
set -euo pipefail

usage() {
    cat <<EOF
Uso:
  ./scripts/restore.sh <backup.sql.gz> [--db <db_name>] [--create-db] [--yes]

Opciones:
  --db <db_name>   Base destino (default: hms_core)
  --create-db      Crea la base destino si no existe
  --yes            Omite confirmación interactiva
EOF
}

if [ $# -lt 1 ]; then
    usage
    exit 1
fi

BACKUP_FILE="$1"
shift

DB_NAME="hms_core"
DB_USER="${DB_USER:-admin}"
CREATE_DB=false
ASSUME_YES=false

while [ $# -gt 0 ]; do
    case "$1" in
        --db)
            DB_NAME="$2"
            shift 2
            ;;
        --create-db)
            CREATE_DB=true
            shift
            ;;
        --yes)
            ASSUME_YES=true
            shift
            ;;
        *)
            echo "❌ Opción no reconocida: $1"
            usage
            exit 1
            ;;
    esac
done

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup no encontrado: $BACKUP_FILE"
    exit 1
fi

if [ "$CREATE_DB" = true ]; then
    echo "🛠️  Creando base destino (si no existe): $DB_NAME"
    docker compose exec -T db bash -lc "psql -U '$DB_USER' -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\" | grep -q 1 || createdb -U '$DB_USER' '$DB_NAME'"
fi

if [ "$ASSUME_YES" != true ]; then
    echo "⚠️  ADVERTENCIA: restaurarás sobre la base destino '$DB_NAME'."
    read -r -p "¿Continuar? (s/n): " confirm
    if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
        echo "Operación cancelada."
        exit 0
    fi
fi

echo "🔄 Restaurando base de datos '$DB_NAME' desde '$BACKUP_FILE'..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "$DB_USER" "$DB_NAME"

echo "✅ Restauración completada con éxito."
