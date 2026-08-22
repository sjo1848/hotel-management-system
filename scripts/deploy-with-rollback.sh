#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<USAGE
Uso:
  ./scripts/deploy-with-rollback.sh [--target-ref <git_ref>] [--env-file <path>] [--profile <auto|dev|staging|prod>] [--skip-tests]

Opciones:
  --target-ref <git_ref>  Ref a desplegar (default: origin/main)
  --env-file <path>       Archivo de variables de entorno (default: .env)
  --profile <...>         Perfil de despliegue (default: auto)
  --skip-tests            Omite health/smoke tests post-deploy (solo local/dev)
USAGE
}

TARGET_REF="origin/main"
SKIP_TESTS=false
ENV_FILE=".env"
DEPLOY_PROFILE="auto"

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
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
if [[ "$DEPLOY_PROFILE" != "auto" && "$DEPLOY_PROFILE" != "dev" && "$DEPLOY_PROFILE" != "staging" && "$DEPLOY_PROFILE" != "prod" ]]; then
  echo "❌ --profile debe ser auto|dev|staging|prod"
  exit 1
fi

PREV_REF="$(git rev-parse --verify HEAD)"
TARGET_COMMIT=""
DEPLOY_TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="predeploy_${DEPLOY_TS}.sql.gz"
BACKUP_DIR="${BACKUP_DIR:-./scripts/backups}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
DEPLOY_START_EPOCH="$(date +%s)"

rollback_needed=false
COMPOSE_ARGS=(--env-file "$ENV_FILE")
COMPOSE_FILE_PATH=""
RUNTIME_PROFILE="unknown"

log_release_event_safe() {
  if [[ ! -x "./scripts/log-release-event.sh" ]]; then
    return 0
  fi
  ./scripts/log-release-event.sh "$@" >/dev/null 2>&1 || true
}

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

compose_build() {
  docker compose "${COMPOSE_ARGS[@]}" build
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
  local rollback_start_epoch
  local rollback_end_epoch
  local rollback_recovery_seconds=0
  local deploy_duration_seconds
  deploy_duration_seconds=$(( $(date +%s) - DEPLOY_START_EPOCH ))

  echo "⚠️  Despliegue fallido. Ejecutando rollback automático..."
  rollback_start_epoch="$(date +%s)"
  if ! git checkout -q "$PREV_REF"; then
    echo "❌ No se pudo volver al commit previo: $PREV_REF"
    log_release_event_safe \
      --event deploy \
      --status failure \
      --field profile="$RUNTIME_PROFILE" \
      --field previous_ref="$PREV_REF" \
      --field target_ref="$TARGET_REF" \
      --field deployed_ref="${TARGET_COMMIT:-unknown}" \
      --field rollback_executed=true \
      --field rollback_status=failed \
      --field reason=rollback_checkout_failed \
      --field duration_seconds="$deploy_duration_seconds" \
      --field recovery_seconds=0
    exit 1
  fi

  echo "🔁 Restaurando servicios al commit previo..."
  if [[ -z "${DATABASE_URL:-}" && -z "${BACKUP_DATABASE_URL:-}" ]]; then
    echo "🗄️  Asegurando DB local para rollback..."
    if ! docker compose "${COMPOSE_ARGS[@]}" up -d db; then
      echo "❌ No se pudo iniciar DB para rollback"
      log_release_event_safe \
        --event deploy \
        --status failure \
        --field profile="$RUNTIME_PROFILE" \
        --field previous_ref="$PREV_REF" \
        --field target_ref="$TARGET_REF" \
        --field deployed_ref="${TARGET_COMMIT:-unknown}" \
        --field rollback_executed=true \
        --field rollback_status=failed \
        --field reason=rollback_db_start_failed \
        --field duration_seconds="$deploy_duration_seconds" \
        --field recovery_seconds=0
      exit 1
    fi
  else
    echo "🗄️  Using injected external PostgreSQL connection for rollback context."
  fi
  echo "ℹ️  Application rollback only: database restore is destructive and is never automatic."
  echo "   If required, enter maintenance mode and run restore.sh separately with explicit confirmation."

  if ! compose_up_with_retry; then
    echo "❌ No se pudo restaurar servicios al commit previo"
    log_release_event_safe \
      --event deploy \
      --status failure \
      --field profile="$RUNTIME_PROFILE" \
      --field previous_ref="$PREV_REF" \
      --field target_ref="$TARGET_REF" \
      --field deployed_ref="${TARGET_COMMIT:-unknown}" \
      --field rollback_executed=true \
      --field rollback_status=failed \
      --field reason=rollback_compose_restore_failed \
      --field duration_seconds="$deploy_duration_seconds" \
      --field recovery_seconds=0
    exit 1
  fi

  rollback_end_epoch="$(date +%s)"
  rollback_recovery_seconds=$((rollback_end_epoch - rollback_start_epoch))
  deploy_duration_seconds=$((rollback_end_epoch - DEPLOY_START_EPOCH))
  log_release_event_safe \
    --event deploy \
    --status failure \
    --field profile="$RUNTIME_PROFILE" \
    --field previous_ref="$PREV_REF" \
    --field target_ref="$TARGET_REF" \
    --field deployed_ref="${TARGET_COMMIT:-unknown}" \
    --field rollback_executed=true \
    --field rollback_status=success \
    --field reason=deploy_failed_rollback_applied \
    --field duration_seconds="$deploy_duration_seconds" \
    --field recovery_seconds="$rollback_recovery_seconds"

  echo "✅ Rollback finalizado sobre commit $(git rev-parse --short HEAD)"
  exit 1
}

trap rollback ERR

echo "🚀 Iniciando despliegue con rollback automático"
echo "• Ref actual: $(git rev-parse --short "$PREV_REF")"
echo "• Ref objetivo: $TARGET_REF"
echo "• Env file: $ENV_FILE"

RUNTIME_PROFILE="$(resolve_profile)"
CHILD_APP_ENV="$RUNTIME_PROFILE"
if [ "$RUNTIME_PROFILE" = "prod" ]; then
  CHILD_APP_ENV="production"
fi
if [ "$RUNTIME_PROFILE" = "prod" ] && [ "$SKIP_TESTS" = true ]; then
  echo "❌ --skip-tests is not allowed for prod" >&2
  exit 1
fi
if [ "$RUNTIME_PROFILE" = "prod" ]; then
  COMPOSE_FILE_PATH="docker-compose.prod.yml"
  COMPOSE_ARGS+=( -f "$COMPOSE_FILE_PATH" )
  echo "• Profile: prod (standalone $COMPOSE_FILE_PATH)"
  ./scripts/validate-env-profile.sh --profile prod --env-file "$ENV_FILE"
elif [ "$RUNTIME_PROFILE" = "staging" ]; then
  COMPOSE_FILE_PATH="docker-compose.staging.yml"
  COMPOSE_ARGS+=( -f "$COMPOSE_FILE_PATH" )
  echo "• Profile: staging (standalone $COMPOSE_FILE_PATH)"
  ./scripts/validate-env-profile.sh --profile staging --env-file "$ENV_FILE"
else
  COMPOSE_FILE_PATH="docker-compose.yml"
  COMPOSE_ARGS+=( -f "$COMPOSE_FILE_PATH" )
  echo "• Profile: dev"
  ./scripts/validate-env-profile.sh --profile dev --env-file "$ENV_FILE"
fi

echo "📥 Resolviendo y fijando versión objetivo..."
git fetch --all --prune

if ! git rev-parse --verify --quiet "$TARGET_REF" >/dev/null; then
  echo "❌ Ref objetivo no encontrada: $TARGET_REF"
  rollback
fi

TARGET_COMMIT="$(git rev-parse --verify "$TARGET_REF")"
git checkout -q "$TARGET_COMMIT"

rollback_needed=true
echo "🏗️  Preflight/build del commit $(git rev-parse --short HEAD)..."
compose_build

echo "📦 Creando backup pre-deploy con $COMPOSE_FILE_PATH..."
FILENAME="$BACKUP_NAME" BACKUP_DIR="$BACKUP_DIR" BACKUP_COMPOSE_FILE="$COMPOSE_FILE_PATH" ENV_FILE="$ENV_FILE" \
  BACKUP_DATABASE_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}" DB_USER="${DB_USER:-}" APP_ENV="$CHILD_APP_ENV" ./scripts/backup.sh

if [[ -n "${MIGRATION_COMMAND:-}" || -n "${MIGRATION_CONFIRMATION:-}" ]]; then
  [[ -n "${MIGRATION_COMMAND:-}" && "${MIGRATION_CONFIRMATION:-}" == APPLY-MIGRATIONS ]] || {
    echo "❌ Migration requires MIGRATION_COMMAND and MIGRATION_CONFIRMATION=APPLY-MIGRATIONS" >&2
    exit 1
  }
  [[ "${ALLOW_DATABASE_OPERATIONS:-}" == true && "${MAINTENANCE_MODE:-}" == true ]] || {
    echo "❌ Migration requires ALLOW_DATABASE_OPERATIONS=true and MAINTENANCE_MODE=true" >&2
    exit 1
  }
  echo "🛠️  Ejecutando migración controlada confirmada..."
  APP_ENV="$CHILD_APP_ENV" ./scripts/migrate-prod.sh
else
  echo "ℹ️  Migración omitida: MIGRATION_COMMAND no fue suministrado explícitamente."
fi

echo "🚀 Aplicando servicios del commit $(git rev-parse --short HEAD)..."
compose_up_with_retry

if [ "$SKIP_TESTS" = false ]; then
  if [ "$RUNTIME_PROFILE" = "prod" ] && [ -z "${DATABASE_URL:-${BACKUP_DATABASE_URL:-}}" ]; then
    echo "❌ Production smoke requires DATABASE_URL or BACKUP_DATABASE_URL" >&2
    exit 1
  fi
  echo "🩺 Ejecutando database production smoke..."
  SMOKE_DATABASE_URL="${DATABASE_URL:-${BACKUP_DATABASE_URL:-}}" APP_ENV="$CHILD_APP_ENV" ./scripts/production-smoke.sh
  echo "🩺 Ejecutando health + authenticated smoke tests..."
  SMOKE_BASE_URL="${SMOKE_BASE_URL:-}" APP_ENV="$CHILD_APP_ENV" ./scripts/smoke-test.sh
fi


rollback_needed=false
trap - ERR

deploy_duration_seconds=$(( $(date +%s) - DEPLOY_START_EPOCH ))
log_release_event_safe \
  --event deploy \
  --status success \
  --field profile="$RUNTIME_PROFILE" \
  --field previous_ref="$PREV_REF" \
  --field target_ref="$TARGET_REF" \
  --field deployed_ref="$TARGET_COMMIT" \
  --field rollback_executed=false \
  --field rollback_status=not_needed \
  --field reason=deploy_success \
  --field duration_seconds="$deploy_duration_seconds" \
  --field recovery_seconds=0

echo "✅ Deploy completado con éxito"
echo "• Commit desplegado: $(git rev-parse --short HEAD)"
echo "• Backup de rollback: $BACKUP_PATH"
