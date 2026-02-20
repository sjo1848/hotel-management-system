#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root."
  exit 1
fi

RUNNER="host"
SKIP_BROWSER=false
MATRIX_DB_PORT="${HMS_E2E_MATRIX_DB_PORT:-55435}"
MATRIX_DB_CONTAINER="hms-e2e-matrix-db-$$"

usage() {
  cat <<USAGE
Usage: $0 [--runner host|docker] [--skip-browser]

Options:
  --runner MODE   host (default) or docker (run Playwright inside frontend container)
  --skip-browser  run only backend cross-role/cross-tenant matrix
  -h, --help      Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner)
      RUNNER="$2"
      shift 2
      ;;
    --skip-browser)
      SKIP_BROWSER=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$RUNNER" != "host" && "$RUNNER" != "docker" ]]; then
  echo "Invalid --runner value: $RUNNER (expected host|docker)" >&2
  exit 1
fi

wait_for_url() {
  local url="$1"
  local tries="${2:-60}"
  local delay="${3:-2}"
  local code

  for attempt in $(seq 1 "$tries"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    if [[ "$code" == "200" || "$code" == "304" ]]; then
      return 0
    fi
    if (( attempt % 10 == 0 )); then
      echo "Waiting for ${url} (attempt ${attempt}/${tries}, last=${code:-n/a})"
    fi
    sleep "$delay"
  done

  echo "Service not ready at $url after $tries attempts." >&2
  return 1
}

wait_for_compose_db() {
  local tries="${1:-60}"
  local delay="${2:-2}"

  for attempt in $(seq 1 "$tries"); do
    if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-hms_core}" >/dev/null 2>&1; then
      return 0
    fi
    if (( attempt % 10 == 0 )); then
      echo "Waiting for docker compose db readiness (attempt ${attempt}/${tries})"
    fi
    sleep "$delay"
  done

  return 1
}

is_transient_sqlx_failure() {
  local output_file="$1"
  grep -qE 'database "_sqlx_test_[^"]+" does not exist|PoolTimedOut|failed to lookup address information|Connection refused|timed out waiting for connection' "$output_file"
}

run_host_sqlx_test_with_retry() {
  local test_name="$1"
  local db_url="$2"
  local attempt=1
  local max_attempts=3
  local output_file
  output_file="$(mktemp)"

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "==> ${test_name} (attempt ${attempt}/${max_attempts})"

    set +e
    (
      cd backend
      DATABASE_URL="$db_url" cargo test --test "${test_name}" -- --test-threads=1 --nocapture
    ) >"$output_file" 2>&1
    local status=$?
    set -e

    cat "$output_file"

    if [ "$status" -eq 0 ]; then
      rm -f "$output_file"
      return 0
    fi

    if is_transient_sqlx_failure "$output_file" && [ "$attempt" -lt "$max_attempts" ]; then
      echo "Detected transient sqlx failure. Retrying ${test_name}..."
      attempt=$((attempt + 1))
      sleep 2
      continue
    fi

    rm -f "$output_file"
    return "$status"
  done

  rm -f "$output_file"
}

cleanup_matrix_db() {
  docker rm -f "$MATRIX_DB_CONTAINER" >/dev/null 2>&1 || true
}

run_backend_matrix() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required to run the isolated backend matrix DB." >&2
    return 1
  fi

  cleanup_matrix_db
  docker run -d \
    --name "$MATRIX_DB_CONTAINER" \
    -e POSTGRES_USER=admin \
    -e POSTGRES_PASSWORD=password123 \
    -e POSTGRES_DB=hms_core \
    -p "${MATRIX_DB_PORT}:5432" \
    postgres:16-alpine >/dev/null

  local ready=false
  for _ in $(seq 1 40); do
    if docker exec "$MATRIX_DB_CONTAINER" pg_isready -U admin -d hms_core >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done

  if [[ "$ready" != "true" ]]; then
    echo "Isolated matrix DB did not become ready." >&2
    docker logs "$MATRIX_DB_CONTAINER" >&2 || true
    return 1
  fi

  local matrix_db_url="postgres://admin:password123@localhost:${MATRIX_DB_PORT}/hms_core"
  echo "==> Running backend cross-role/cross-tenant matrix (isolated DB ${MATRIX_DB_PORT})"
  run_host_sqlx_test_with_retry "rbac_authorization" "$matrix_db_url"
  run_host_sqlx_test_with_retry "tenant_rls_phase1" "$matrix_db_url"
  run_host_sqlx_test_with_retry "tenant_context_runtime" "$matrix_db_url"
}

trap cleanup_matrix_db EXIT

run_backend_matrix

if [[ "$SKIP_BROWSER" == "true" ]]; then
  echo "==> Browser E2E skipped by flag --skip-browser"
  echo "==> HMS-QA-010 backend matrix: PASS"
  exit 0
fi

echo "==> Starting E2E stack (db/backend/frontend)"
docker compose up -d db backend frontend

echo "==> Waiting for db"
if ! wait_for_compose_db 60 2; then
  echo "==> DB did not become ready. Recent compose logs:" >&2
  docker compose logs --no-color --tail=120 db backend frontend >&2 || true
  exit 1
fi

echo "==> Restarting backend after db readiness"
docker compose restart backend >/dev/null 2>&1 || true

echo "==> Waiting for backend"
if ! wait_for_url "http://localhost:3001/health" 90 2; then
  echo "==> Backend did not become healthy. Recent compose logs:" >&2
  docker compose logs --no-color --tail=120 db backend frontend >&2 || true
  exit 1
fi

echo "==> Waiting for frontend"
if ! wait_for_url "http://localhost:5173/login" 90 2; then
  echo "==> Frontend did not become healthy. Recent compose logs:" >&2
  docker compose logs --no-color --tail=120 backend frontend >&2 || true
  exit 1
fi

echo "==> Running Playwright core journeys"
if [[ "$RUNNER" == "docker" ]]; then
  echo "==> Installing Playwright browsers in frontend container"
  docker compose exec -T frontend npx playwright install chromium chromium-headless-shell
  docker compose exec -T frontend sh -lc '
    npx playwright test --grep "journey|lifecycle|billing|rbac"
  '
else
  (
    cd frontend
    npx playwright install --with-deps chromium chromium-headless-shell
    PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}" \
      npm run test:e2e -- --grep "journey|lifecycle|billing|rbac"
  )
fi

echo "==> HMS-QA-010 browser E2E core journeys + matrix: PASS"
