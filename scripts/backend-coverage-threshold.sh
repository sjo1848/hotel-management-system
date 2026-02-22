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

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 15); do
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT 1;' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

resolve_runner() {
  if wait_for_postgres; then
    echo "host"
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
    if docker compose ps --services 2>/dev/null | grep -qx backend; then
      echo "docker"
      return 0
    fi
  fi

  return 1
}

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
    */src/infrastructure/web/middleware/rbac.rs|*/src/infrastructure/web/middleware/auth.rs|*/src/infrastructure/web/middleware/request_id.rs)
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

RUNNER="$(resolve_runner || true)"
if [ -z "${RUNNER:-}" ]; then
  echo "Postgres is not ready for DATABASE_URL=$DATABASE_URL and docker backend runner is unavailable." >&2
  exit 1
fi

if [ "$RUNNER" = "host" ]; then
  require_tooling
  require_llvm_tools
fi

echo "==> backend coverage thresholds (auth=${AUTH_THRESHOLD} booking=${BOOKING_THRESHOLD} tenant=${TENANT_THRESHOLD})"
if [ "$RUNNER" = "host" ]; then
  (
    cd backend
    cargo llvm-cov \
      --all-features \
      --lcov \
      --output-path "$LCOV_FILE" \
      --test csrf_authn_security \
      --test rbac_authorization \
      --test booking_flow \
      --test booking_transactional_integrity \
      --test operational_flow
  )
else
  echo "Host DATABASE_URL is unreachable; running coverage in docker backend runner."
  CONTAINER_LCOV_FILE="/app/backend/target/llvm-cov-target/hms_backend_coverage.info"
  LCOV_FILE="backend/target/llvm-cov-target/hms_backend_coverage.info"
  docker compose exec -T backend env PATH=/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin sh -c "
    set -euo pipefail
    mkdir -p /app/backend/target/llvm-cov-target
    if ! cargo llvm-cov --version >/dev/null 2>&1; then
      cargo install cargo-llvm-cov --locked >/dev/null
    fi
    rustup component add llvm-tools-preview >/dev/null 2>&1 || true
    cargo llvm-cov \
      --all-features \
      --lcov \
      --output-path \"$CONTAINER_LCOV_FILE\" \
      --test csrf_authn_security \
      --test rbac_authorization \
      --test booking_flow \
      --test booking_transactional_integrity \
      --test operational_flow
  "
  mkdir -p "$(dirname "$LCOV_FILE")"
  docker compose exec -T backend cat "$CONTAINER_LCOV_FILE" > "$LCOV_FILE"
fi

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
