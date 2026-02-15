#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

RUNNER="host"
export DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}

usage() {
  cat <<USAGE
Usage: $0 [--runner host|docker]
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

check_pattern() {
  local file="$1"
  local pattern="$2"
  local description="$3"
  if ! grep -qE "$pattern" "$file"; then
    echo "Missing observability instrumentation: ${description}" >&2
    echo "Expected pattern: ${pattern}" >&2
    echo "File: ${file}" >&2
    exit 1
  fi
}

echo "==> observability static instrumentation checks"
check_pattern "backend/src/infrastructure/web/middleware/request_id.rs" "tenant_id = Empty" "request span tenant_id field"
check_pattern "backend/src/infrastructure/web/middleware/request_id.rs" "user_id = Empty" "request span user_id field"
check_pattern "backend/src/infrastructure/web/middleware/request_id.rs" "role = Empty" "request span role field"
check_pattern "backend/src/infrastructure/web/middleware/request_id.rs" "error_code = Empty" "request span error_code field"
check_pattern "backend/src/infrastructure/web/middleware/auth.rs" "span\\.record\\(\"tenant_id\"" "auth middleware records tenant_id"
check_pattern "backend/src/infrastructure/web/middleware/auth.rs" "span\\.record\\(\"user_id\"" "auth middleware records user_id"
check_pattern "backend/src/infrastructure/web/middleware/auth.rs" "span\\.record\\(\"role\"" "auth middleware records role"
check_pattern "backend/src/infrastructure/web/handlers.rs" "record\\(\"error_code\"" "error handler records error_code"
check_pattern "backend/src/infrastructure/web/handlers/auth.rs" "name = \"auth\\.login\"" "login tracing span"
check_pattern "backend/src/infrastructure/web/handlers/ops/bookings.rs" "name = \"booking\\.create\"" "create booking tracing span"
check_pattern "backend/src/infrastructure/web/handlers/ops/finance.rs" "name = \"cash\\.close\"" "close cash tracing span"

echo "==> observability runtime contract test (runner=${RUNNER})"
attempt=1
max_attempts=3
while [ "$attempt" -le "$max_attempts" ]; do
  output_file="$(mktemp)"
  set +e
  if [[ "$RUNNER" == "docker" ]]; then
    docker compose exec -T backend cargo test --test observability_context -- --test-threads=1 --nocapture >"$output_file" 2>&1
  else
    (
      cd backend
      cargo test --test observability_context -- --test-threads=1 --nocapture
    ) >"$output_file" 2>&1
  fi
  status=$?
  set -e
  cat "$output_file"
  if [ "$status" -eq 0 ]; then
    rm -f "$output_file"
    break
  fi
  if grep -qE 'database "_sqlx_test_[^"]+" does not exist|PoolTimedOut|failed to lookup address information|Connection refused|timed out waiting for connection' "$output_file" \
    && [ "$attempt" -lt "$max_attempts" ]; then
    rm -f "$output_file"
    attempt=$((attempt + 1))
    echo "Detected transient sqlx/database setup failure. Retrying observability smoke..."
    sleep 2
    continue
  fi
  rm -f "$output_file"
  exit "$status"
done

echo "==> observability smoke: PASS"
