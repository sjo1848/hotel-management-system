#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

export DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}

run_sqlx_test_with_retry() {
  local test_name="$1"
  local attempt=1
  local max_attempts=4
  local base_backoff_seconds=2
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

    if grep -qE 'database "_sqlx_test_[^"]+" does not exist|failed to connect (test pool|to setup test database): .*PoolTimedOut|timed out while waiting for an open connection|pool timed out while waiting for an open connection' "$output_file"; then
      if [ "$attempt" -lt "$max_attempts" ]; then
        local sleep_seconds=$((base_backoff_seconds * attempt))
        echo "Detected transient sqlx test DB race. Retrying ${test_name} after ${sleep_seconds}s backoff..."
        sleep "$sleep_seconds"
        attempt=$((attempt + 1))
        continue
      fi
    fi

    return "$status"
  done
}

run_sqlx_test_with_retry "rbac_authorization"
run_sqlx_test_with_retry "csrf_authn_security"
