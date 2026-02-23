#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

export DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}

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
  local test_name="$1"
  local attempt=1
  local max_attempts=3
  local output_file
  output_file="$(mktemp)"
  trap 'rm -f "$output_file"' RETURN

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "==> ${test_name} (attempt ${attempt}/${max_attempts})"

    set +e
    (
      cd backend
      cargo test --test "${test_name}" -- --test-threads=1 --nocapture
    ) >"$output_file" 2>&1
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

wait_for_postgres

# contract test (fast, no sqlx::test)
(
  cd backend
  cargo test --test openapi_contract
)

# DB integration gates (sqlx::test)
run_sqlx_test_with_retry "analytics_flow"
run_sqlx_test_with_retry "operational_flow"
run_sqlx_test_with_retry "tenant_uniqueness_constraints"
run_sqlx_test_with_retry "tenant_rls_phase1"
run_sqlx_test_with_retry "booking_flow"
run_sqlx_test_with_retry "tenant_fk_integrity"
run_sqlx_test_with_retry "booking_transactional_integrity"
run_sqlx_test_with_retry "room_management"
run_sqlx_test_with_retry "tenant_context_runtime"
