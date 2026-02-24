#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

to_bool() {
  local raw="${1:-false}"
  case "${raw,,}" in
    1|true|yes|on) echo "true" ;;
    *) echo "false" ;;
  esac
}

STRICT_MODE="$(to_bool "${HMS_COVERAGE_STRICT:-${CI:-false}}")"
AUTO_INSTALL="$(to_bool "${HMS_AUTO_INSTALL_LLVM_COV:-false}")"
AUTH_THRESHOLD="${HMS_COVERAGE_AUTH_MIN:-70}"
BOOKING_THRESHOLD="${HMS_COVERAGE_BOOKING_MIN:-45}"
TENANT_THRESHOLD="${HMS_COVERAGE_TENANT_MIN:-45}"
LCOV_FILE="${HMS_COVERAGE_LCOV_FILE:-/tmp/hms_backend_coverage.info}"
export DATABASE_URL="${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}"
COVERAGE_DB_MODE="${HMS_COVERAGE_DB_MODE:-auto}" # auto|shared|isolated

if [[ "$COVERAGE_DB_MODE" != "auto" && "$COVERAGE_DB_MODE" != "shared" && "$COVERAGE_DB_MODE" != "isolated" ]]; then
  echo "Invalid HMS_COVERAGE_DB_MODE: ${COVERAGE_DB_MODE} (expected auto|shared|isolated)" >&2
  exit 1
fi

require_tooling() {
  if cargo llvm-cov --version >/dev/null 2>&1; then
    return 0
  fi

  if [ "$AUTO_INSTALL" = "true" ]; then
    echo "cargo-llvm-cov not found; installing..."
    cargo install cargo-llvm-cov --locked
    return 0
  fi

  if [ "$STRICT_MODE" = "true" ]; then
    echo "cargo-llvm-cov is required in strict mode." >&2
    echo "Install with: cargo install cargo-llvm-cov --locked" >&2
    return 1
  fi

  echo "cargo-llvm-cov not found; skipping coverage thresholds (non-strict mode)."
  exit 0
}

require_llvm_tools() {
  if rustup component add llvm-tools-preview >/dev/null 2>&1; then
    return 0
  fi
  if [ "$STRICT_MODE" = "true" ]; then
    echo "llvm-tools-preview component is required in strict mode." >&2
    return 1
  fi
  echo "llvm-tools-preview unavailable; skipping coverage thresholds (non-strict mode)."
  exit 0
}

module_for_file() {
  local file="$1"
  case "$file" in
    */src/application/auth_service.rs|*/src/infrastructure/web/handlers/auth.rs|*/src/infrastructure/web/middleware/auth.rs|*/src/infrastructure/web/jwt.rs)
      echo "auth"
      ;;
    */src/application/booking_service.rs|*/src/application/booking_transaction_service.rs|*/src/infrastructure/web/handlers/ops/bookings.rs)
      echo "booking"
      ;;
    */src/infrastructure/web/middleware/rbac.rs|*/src/infrastructure/web/middleware/rbac_generated.rs|*/src/infrastructure/web/middleware/auth.rs|*/src/infrastructure/web/middleware/request_id.rs)
      echo "tenant"
      ;;
    *)
      echo ""
      ;;
  esac
}

compute_percent() {
  local covered="$1"
  local total="$2"
  awk -v c="$covered" -v t="$total" 'BEGIN {
    if (t <= 0) {
      print "0.00";
    } else {
      printf "%.2f", (c * 100.0) / t;
    }
  }'
}

is_above_threshold() {
  local percent="$1"
  local threshold="$2"
  awk -v p="$percent" -v t="$threshold" 'BEGIN { exit ((p + 0) >= (t + 0) ? 0 : 1) }'
}

require_tooling
require_llvm_tools

is_transient_sqlx_failure() {
  local output_file="$1"
  grep -qE 'PoolTimedOut|failed to connect to setup test database|timed out while waiting for an open connection|Connection refused|failed to lookup address information' "$output_file"
}

ISOLATED_DB_CONTAINER=""
coverage_output=""

cleanup_resources() {
  if [[ -n "$coverage_output" ]]; then
    rm -f "$coverage_output" >/dev/null 2>&1 || true
  fi
  if [[ -n "$ISOLATED_DB_CONTAINER" ]]; then
    docker rm -f "$ISOLATED_DB_CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup_resources EXIT

setup_isolated_db_if_needed() {
  local use_isolated="false"
  if [[ "$COVERAGE_DB_MODE" == "isolated" ]]; then
    use_isolated="true"
  elif [[ "$COVERAGE_DB_MODE" == "auto" && -n "$(command -v docker || true)" ]]; then
    use_isolated="true"
  fi

  if [[ "$use_isolated" != "true" ]]; then
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1; then
    if [[ "$STRICT_MODE" == "true" ]]; then
      echo "Docker is required when HMS_COVERAGE_DB_MODE=isolated in strict mode." >&2
      exit 1
    fi
    echo "docker unavailable; falling back to shared DATABASE_URL for coverage."
    return 0
  fi

  ISOLATED_DB_CONTAINER="hms-coverage-db-$$"
  docker rm -f "$ISOLATED_DB_CONTAINER" >/dev/null 2>&1 || true
  docker run -d \
    --name "$ISOLATED_DB_CONTAINER" \
    -e POSTGRES_USER=admin \
    -e POSTGRES_PASSWORD=password123 \
    -e POSTGRES_DB=hms_core \
    -p 127.0.0.1::5432 \
    postgres:16-alpine >/dev/null

  local mapped_port
  mapped_port="$(docker port "$ISOLATED_DB_CONTAINER" 5432/tcp | awk -F: '{print $2}' | head -n1)"
  if [[ -z "$mapped_port" ]]; then
    echo "Failed to determine mapped port for isolated coverage DB." >&2
    exit 1
  fi

  local pg_ready=false
  local attempt
  for attempt in $(seq 1 45); do
    if docker exec "$ISOLATED_DB_CONTAINER" pg_isready -U admin -d hms_core >/dev/null 2>&1; then
      pg_ready=true
      break
    fi
    sleep 1
  done
  if [[ "$pg_ready" != "true" ]]; then
    echo "Isolated coverage postgres did not become ready." >&2
    exit 1
  fi

  DATABASE_URL="postgres://admin:password123@127.0.0.1:${mapped_port}/hms_core"
  export DATABASE_URL
  echo "Using isolated coverage DB at ${DATABASE_URL}"
}

run_coverage_collection() {
  local output_file="$1"
  set +e
  (
    cd backend
    cargo llvm-cov \
      --all-features \
      --lcov \
      --output-path "$LCOV_FILE" \
      --test csrf_authn_security \
      --test rbac_authorization \
      --test booking_flow \
      --test operational_flow \
      -- \
      --test-threads=1
  ) >"$output_file" 2>&1
  local status=$?
  set -e
  return "$status"
}

echo "==> backend coverage thresholds (auth=${AUTH_THRESHOLD} booking=${BOOKING_THRESHOLD} tenant=${TENANT_THRESHOLD})"
setup_isolated_db_if_needed
coverage_output="$(mktemp)"

attempt=1
max_attempts=3
coverage_status=1
while [ "$attempt" -le "$max_attempts" ]; do
  echo "==> coverage run (attempt ${attempt}/${max_attempts})"
  if run_coverage_collection "$coverage_output"; then
    coverage_status=0
    break
  fi

  cat "$coverage_output"
  if is_transient_sqlx_failure "$coverage_output" && [ "$attempt" -lt "$max_attempts" ]; then
    echo "Detected transient sqlx coverage failure. Retrying..."
    attempt=$((attempt + 1))
    sleep 2
    continue
  fi
  break
done

if [ "$coverage_status" -ne 0 ]; then
  if [ "$STRICT_MODE" = "true" ]; then
    echo "Coverage collection failed in strict mode." >&2
    exit 1
  fi
  if is_transient_sqlx_failure "$coverage_output"; then
    echo "Coverage collection skipped in non-strict mode due to transient DB/connectivity issue."
    exit 0
  fi
  cat "$coverage_output"
  exit 1
fi

cat "$coverage_output"

if [ ! -s "$LCOV_FILE" ]; then
  echo "Coverage report not generated: $LCOV_FILE" >&2
  exit 1
fi

declare -A totals
declare -A covered
totals[auth]=0
totals[booking]=0
totals[tenant]=0
covered[auth]=0
covered[booking]=0
covered[tenant]=0

current_module=""
while IFS= read -r line; do
  case "$line" in
    SF:*)
      source_file="${line#SF:}"
      current_module="$(module_for_file "$source_file")"
      ;;
    DA:*)
      if [ -n "$current_module" ]; then
        data="${line#DA:}"
        hits="${data##*,}"
        totals["$current_module"]=$(( totals["$current_module"] + 1 ))
        if [ "$hits" -gt 0 ]; then
          covered["$current_module"]=$(( covered["$current_module"] + 1 ))
        fi
      fi
      ;;
    end_of_record)
      current_module=""
      ;;
  esac
done < "$LCOV_FILE"

auth_percent="$(compute_percent "${covered[auth]}" "${totals[auth]}")"
booking_percent="$(compute_percent "${covered[booking]}" "${totals[booking]}")"
tenant_percent="$(compute_percent "${covered[tenant]}" "${totals[tenant]}")"

printf "  auth:    %s%% (%s/%s)\n" "$auth_percent" "${covered[auth]}" "${totals[auth]}"
printf "  booking: %s%% (%s/%s)\n" "$booking_percent" "${covered[booking]}" "${totals[booking]}"
printf "  tenant:  %s%% (%s/%s)\n" "$tenant_percent" "${covered[tenant]}" "${totals[tenant]}"

if [ "${totals[auth]}" -eq 0 ] || [ "${totals[booking]}" -eq 0 ] || [ "${totals[tenant]}" -eq 0 ]; then
  echo "Coverage module mapping is empty for at least one critical module." >&2
  exit 1
fi

if ! is_above_threshold "$auth_percent" "$AUTH_THRESHOLD"; then
  echo "Auth coverage below threshold (${auth_percent}% < ${AUTH_THRESHOLD}%)." >&2
  exit 1
fi
if ! is_above_threshold "$booking_percent" "$BOOKING_THRESHOLD"; then
  echo "Booking coverage below threshold (${booking_percent}% < ${BOOKING_THRESHOLD}%)." >&2
  exit 1
fi
if ! is_above_threshold "$tenant_percent" "$TENANT_THRESHOLD"; then
  echo "Tenant coverage below threshold (${tenant_percent}% < ${TENANT_THRESHOLD}%)." >&2
  exit 1
fi

echo "Backend coverage thresholds: PASS"
