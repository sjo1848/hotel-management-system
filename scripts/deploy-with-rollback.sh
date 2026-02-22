#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Uso:
  ./scripts/deploy-with-rollback.sh [--target-ref <git_ref>] [--env-file <path>] [--profile <auto|dev|staging|prod>] [--skip-tests] [--skip-synthetics]

Opciones:
  --target-ref <git_ref>  Ref a desplegar (default: origin/main)
  --env-file <path>       Archivo de variables de entorno (default: .env)
  --profile <...>         Perfil de despliegue (default: auto)
  --skip-tests            Omite health/smoke/synthetics post-deploy
  --skip-synthetics       Omite synthetics post-deploy (mantiene smoke)
  --synthetics-report P   Ruta del reporte markdown de synthetics (default: /tmp/hms_post_deploy_synthetics.md)
  --synthetics-base-url U Base URL del backend para synthetics (default: http://localhost:3001)
  --synthetics-hotel-id H Hotel ID/nombre para login sintético (opcional)
USAGE
}

TARGET_REF="origin/main"
SKIP_TESTS=false
SKIP_SYNTHETICS=false
ENV_FILE=".env"
DEPLOY_PROFILE="auto"
SYNTHETICS_REPORT="/tmp/hms_post_deploy_synthetics.md"
SYNTHETICS_BASE_URL="http://localhost:3001"
SYNTHETICS_HOTEL_ID=""

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
    --skip-synthetics)
      SKIP_SYNTHETICS=true
      shift
      ;;
    --env-file)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --env-file"
        usage
        exit 1
      fi
      ENV_FILE="$2"
      shift 2
      ;;
    --profile)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --profile"
        usage
        exit 1
      fi
      DEPLOY_PROFILE="$2"
      shift 2
      ;;
    --synthetics-report)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --synthetics-report"
        usage
        exit 1
      fi
      SYNTHETICS_REPORT="$2"
      shift 2
      ;;
    --synthetics-base-url)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --synthetics-base-url"
        usage
        exit 1
      fi
      SYNTHETICS_BASE_URL="$2"
      shift 2
      ;;
    --synthetics-hotel-id)
      if [ $# -lt 2 ]; then
        echo "❌ Falta valor para --synthetics-hotel-id"
        usage
        exit 1
      fi
      SYNTHETICS_HOTEL_ID="$2"
      shift 2
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
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No se encontró env file: $ENV_FILE"
  exit 1
fi
if [[ "$DEPLOY_PROFILE" != "auto" && "$DEPLOY_PROFILE" != "dev" && "$DEPLOY_PROFILE" != "staging" && "$DEPLOY_PROFILE" != "prod" ]]; then
  echo "❌ --profile debe ser auto|dev|staging|prod"
  exit 1
fi

PREV_REF="$(git rev-parse --verify HEAD)"
DEPLOY_TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="predeploy_${DEPLOY_TS}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

rollback_needed=false
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.yml)

resolve_profile() {
  if [ "$DEPLOY_PROFILE" != "auto" ]; then
    echo "$DEPLOY_PROFILE"
    return
  fi

  local profile
  profile="$(awk -F= '/^APP_ENV=/{print tolower($2)}' "$ENV_FILE" | tail -n1 | tr -d '\"' | tr -d "'" | tr -d ' ')"
  case "$profile" in
    prod|production) echo "prod" ;;
    staging) echo "staging" ;;
    *) echo "dev" ;;
  esac
}

compose_up() {
  docker compose "${COMPOSE_ARGS[@]}" up -d --build
}

compose_up_with_retry() {
  if compose_up; then
    return 0
  fi

  echo "⚠️  compose up failed; trying cleanup + retry..."
  docker compose "${COMPOSE_ARGS[@]}" rm -sf backend frontend db >/dev/null 2>&1 || true
  compose_up
}

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
  echo "🗄️  Asegurando DB para rollback..."
  if ! docker compose "${COMPOSE_ARGS[@]}" up -d db; then
    echo "❌ No se pudo iniciar DB para rollback"
    exit 1
  fi
  if [ -f "$BACKUP_PATH" ]; then
    echo "🗄️  Restaurando base de datos desde backup pre-deploy..."
    if ! ./scripts/restore.sh "$BACKUP_PATH" --recreate-db --yes; then
      echo "❌ Falló la restauración de DB durante rollback"
      exit 1
    fi
  else
    echo "⚠️  No se encontró backup pre-deploy en $BACKUP_PATH"
  fi

  if ! compose_up_with_retry; then
    echo "❌ No se pudo restaurar servicios al commit previo"
    exit 1
  fi

  echo "✅ Rollback finalizado sobre commit $(git rev-parse --short HEAD)"
  exit 1
}

trap rollback ERR

echo "🚀 Iniciando despliegue con rollback automático"
echo "• Ref actual: $(git rev-parse --short "$PREV_REF")"
echo "• Ref objetivo: $TARGET_REF"
echo "• Env file: $ENV_FILE"

RUNTIME_PROFILE="$(resolve_profile)"
if [ "$RUNTIME_PROFILE" = "prod" ]; then
  COMPOSE_ARGS+=( -f docker-compose.prod.yml )
  echo "• Profile: prod (overlay docker-compose.prod.yml)"
  ./scripts/validate-env-profile.sh --profile prod --env-file "$ENV_FILE"
elif [ "$RUNTIME_PROFILE" = "staging" ]; then
  COMPOSE_ARGS+=( -f docker-compose.staging.yml )
  echo "• Profile: staging (overlay docker-compose.staging.yml)"
  ./scripts/validate-env-profile.sh --profile staging --env-file "$ENV_FILE"
else
  echo "• Profile: dev"
  ./scripts/validate-env-profile.sh --profile dev --env-file "$ENV_FILE"
fi

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
compose_up_with_retry

if [ "$SKIP_TESTS" = false ]; then
  echo "🩺 Ejecutando health + smoke tests..."
  ./scripts/smoke-test.sh --env-file "$ENV_FILE" --base-url "$SYNTHETICS_BASE_URL"

  if [ "$SKIP_SYNTHETICS" = false ]; then
    echo "🧪 Ejecutando synthetics post-deploy..."
    SYNTHETICS_ARGS=(
      --env-file "$ENV_FILE"
      --profile "$RUNTIME_PROFILE"
      --base-url "$SYNTHETICS_BASE_URL"
      --report "$SYNTHETICS_REPORT"
    )
    if [ -n "$SYNTHETICS_HOTEL_ID" ]; then
      SYNTHETICS_ARGS+=(--hotel-id "$SYNTHETICS_HOTEL_ID")
    fi
    ./scripts/post-deploy-synthetics.sh "${SYNTHETICS_ARGS[@]}"
  else
    echo "⏭️  Synthetics post-deploy omitidos por --skip-synthetics"
  fi
else
  echo "⏭️  Tests post-deploy omitidos por --skip-tests (incluye smoke + synthetics)"
fi

rollback_needed=false
trap - ERR

echo "✅ Deploy completado con éxito"
echo "• Commit desplegado: $(git rev-parse --short HEAD)"
echo "• Backup de rollback: $BACKUP_PATH"
if [ "$SKIP_TESTS" = false ] && [ "$SKIP_SYNTHETICS" = false ]; then
  echo "• Reporte synthetics: $SYNTHETICS_REPORT"
fi
