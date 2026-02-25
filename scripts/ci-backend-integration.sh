#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

export DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}
RUNNER="${RUNNER:-auto}"

usage() {
  cat <<USAGE
Usage: $0 [--runner auto|host|docker]

Options:
  --runner MODE   auto (default), host, docker
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner)
      RUNNER="$2"
      shift 2
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

resolve_runner() {
  if [[ "$RUNNER" == "host" || "$RUNNER" == "docker" ]]; then
    echo "$RUNNER"
    return
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose config --services 2>/dev/null | grep -qx backend; then
      echo "docker"
      return
    fi
  fi

  if command -v psql >/dev/null 2>&1; then
    echo "host"
    return
  fi

  echo "host"
}

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 30); do
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Postgres is not ready for DATABASE_URL=$DATABASE_URL" >&2
  return 1
}

is_transient_sqlx_failure() {
  local output_file="$1"
  grep -qE 'database "_sqlx_test_[^"]+" does not exist|PoolTimedOut|failed to lookup address information|Connection refused|timed out waiting for connection' "$output_file"
}

run_sqlx_test_with_retry() {
  local runner="$1"
  local test_name="$2"
  local attempt=1
  local max_attempts=3
  local output_file
  output_file="$(mktemp)"
  trap 'rm -f "$output_file"' RETURN

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "==> ${test_name} (attempt ${attempt}/${max_attempts})"

    set +e
    if [[ "$runner" == "docker" ]]; then
      docker compose exec -T backend cargo test --test "${test_name}" -- --test-threads=1 --nocapture >"$output_file" 2>&1
    else
      (
        cd backend
        cargo test --test "${test_name}" -- --test-threads=1 --nocapture
      ) >"$output_file" 2>&1
    fi
    local status=$?
    set -e

    cat "$output_file"

    if [ "$status" -eq 0 ]; then
      return 0
    fi

    if is_transient_sqlx_failure "$output_file" && [ "$attempt" -lt "$max_attempts" ]; then
      echo "Detected transient sqlx failure. Retrying ${test_name}..."
      attempt=$((attempt + 1))
      sleep 2
      continue
    fi

    return "$status"
  done
}

RUNNER_RESOLVED="$(resolve_runner)"
echo "==> backend integration runner: ${RUNNER_RESOLVED}"

if [[ "$RUNNER_RESOLVED" == "host" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql not found for host runner. Use --runner docker or install psql." >&2
    exit 1
  fi
  wait_for_postgres
fi

# contract test (fast, no sqlx::test)
if [[ "$RUNNER_RESOLVED" == "docker" ]]; then
  docker compose exec -T backend cargo test --test openapi_contract
else
  (
    cd backend
    cargo test --test openapi_contract
  )
fi

# DB integration gates (sqlx::test)
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "analytics_flow"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "operational_flow"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "tenant_uniqueness_constraints"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "tenant_rls_phase1"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "booking_flow"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "tenant_fk_integrity"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "booking_transactional_integrity"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "room_management"
run_sqlx_test_with_retry "$RUNNER_RESOLVED" "tenant_context_runtime"
