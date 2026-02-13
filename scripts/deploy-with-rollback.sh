#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Uso:
  ./scripts/deploy-with-rollback.sh [--target-ref <git_ref>] [--skip-tests]

Opciones:
  --target-ref <git_ref>  Ref a desplegar (default: origin/main)
  --skip-tests            Omite health/smoke tests post-deploy
USAGE
}

TARGET_REF="origin/main"
SKIP_TESTS=false

while [ $# -gt 0 ]; do
  case "$1" in
    --target-ref)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --target-ref"
        usage
        exit 1
      fi
      TARGET_REF="$2"
      shift 2
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Opción no reconocida: $1"
      usage
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker no está disponible en el host"
  exit 1
fi

PREV_REF="$(git rev-parse --verify HEAD)"
DEPLOY_TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="predeploy_${DEPLOY_TS}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

rollback_needed=false

rollback() {
  if [ "$rollback_needed" != true ]; then
    return
  fi

  trap - ERR
  echo "⚠️  Despliegue fallido. Ejecutando rollback automático..."
  if ! git checkout -q "$PREV_REF"; then
    echo "❌ No se pudo volver al commit previo: $PREV_REF"
    exit 1
  fi

  echo "🔁 Restaurando servicios al commit previo..."
  if ! docker compose up -d --build; then
    echo "❌ No se pudo restaurar servicios al commit previo"
    exit 1
  fi

  if [ -f "$BACKUP_PATH" ]; then
    echo "🗄️  Restaurando base de datos desde backup pre-deploy..."
    if ! ./scripts/restore.sh "$BACKUP_PATH" --yes; then
      echo "❌ Falló la restauración de DB durante rollback"
      exit 1
    fi
  else
    echo "⚠️  No se encontró backup pre-deploy en $BACKUP_PATH"
  fi

  echo "✅ Rollback finalizado sobre commit $(git rev-parse --short HEAD)"
  exit 1
}

trap rollback ERR

echo "🚀 Iniciando despliegue con rollback automático"
echo "• Ref actual: $(git rev-parse --short "$PREV_REF")"
echo "• Ref objetivo: $TARGET_REF"

echo "📦 Creando backup pre-deploy..."
FILENAME="$BACKUP_NAME" BACKUP_DIR="$BACKUP_DIR" ./scripts/backup.sh

rollback_needed=true

echo "📥 Actualizando refs remotas..."
git fetch --all --prune

if ! git rev-parse --verify --quiet "$TARGET_REF" >/dev/null; then
  echo "❌ Ref objetivo no encontrada: $TARGET_REF"
  rollback
fi

TARGET_COMMIT="$(git rev-parse --verify "$TARGET_REF")"
git checkout -q "$TARGET_COMMIT"

echo "🏗️  Aplicando despliegue del commit $(git rev-parse --short HEAD)..."
docker compose up -d --build

if [ "$SKIP_TESTS" = false ]; then
  echo "🩺 Ejecutando health + smoke tests..."
  ./scripts/smoke-test.sh
fi

rollback_needed=false
trap - ERR

echo "✅ Deploy completado con éxito"
echo "• Commit desplegado: $(git rev-parse --short HEAD)"
echo "• Backup de rollback: $BACKUP_PATH"
