#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

export DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}
RUNNER="host"

usage() {
  cat <<USAGE
Usage: $0 [--runner host|docker]

Options:
  --runner MODE   Execution mode for tests.
                  host   -> run cargo tests on host (default, CI mode)
                  docker -> run cargo tests via docker compose backend container
  -h, --help      Show this help
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

if [[ "$RUNNER" != "host" && "$RUNNER" != "docker" ]]; then
  echo "Invalid --runner value: $RUNNER (expected host|docker)" >&2
  exit 1
fi

is_transient_sqlx_failure() {
  local output_file="$1"
  grep -qE 'database "_sqlx_test_[^"]+" does not exist|PoolTimedOut|failed to lookup address information|Connection refused|timed out waiting for connection' "$output_file"
}

run_test_with_retry() {
  local test_name="$1"
  local attempt=1
  local max_attempts=3
  local output_file
  output_file="$(mktemp)"
  trap 'rm -f "$output_file"' RETURN

  while [ "$attempt" -le "$max_attempts" ]; do
    echo "==> ${test_name} (attempt ${attempt}/${max_attempts})"

    set +e
    if [[ "$RUNNER" == "docker" ]]; then
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

echo "==> HMS-QA-010 core journeys (runner=${RUNNER})"
run_test_with_retry "csrf_authn_security"
run_test_with_retry "rbac_authorization"
run_test_with_retry "booking_flow"
run_test_with_retry "operational_flow"

echo "==> HMS-QA-010 core journeys: PASS"
