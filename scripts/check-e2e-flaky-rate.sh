#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

RUNNER="${RUNNER:-pw-container}"
RUNS="${HMS_E2E_FLAKY_RUNS:-30}"
MAX_FAILURE_RATE="${HMS_E2E_FLAKY_MAX_FAILURE_RATE:-1}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}"
GREP_PATTERN="${HMS_E2E_FLAKY_GREP:-journey|lifecycle|billing|rbac}"
REPORT_FILE="${HMS_E2E_FLAKY_REPORT:-/tmp/hms_e2e_flaky_report.md}"
PW_IMAGE="${HMS_E2E_PW_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
MANAGE_STACK=true
DEFAULT_E2E_HOTEL_ID="00000000-0000-0000-0000-000000000001"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

E2E_HOTEL_ID_VALUE="${E2E_HOTEL_ID:-$DEFAULT_E2E_HOTEL_ID}"
E2E_USERNAME_VALUE="${E2E_USERNAME:-${ADMIN_USER:-admin}}"
E2E_PASSWORD_VALUE="${E2E_PASSWORD:-${ADMIN_PASSWORD:-admin123}}"

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --runner host|docker|pw-container
                                Where Playwright runs (default: pw-container)
  --runs N                      Number of E2E runs to execute (default: 30)
  --max-failure-rate PCT        Allowed failure percentage, e.g. 1 for 1% (default: 1)
  --base-url URL                Frontend base URL (default: http://localhost:5173)
  --grep REGEX                  Playwright grep filter (default: journey|lifecycle|billing|rbac)
  --report FILE                 Report output path (default: /tmp/hms_e2e_flaky_report.md)
  --no-manage-stack             Do not start/stop docker compose services
  -h, --help                    Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner) RUNNER="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --max-failure-rate) MAX_FAILURE_RATE="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --grep) GREP_PATTERN="$2"; shift 2 ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    --no-manage-stack) MANAGE_STACK=false; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$RUNNER" != "host" && "$RUNNER" != "docker" && "$RUNNER" != "pw-container" ]]; then
  echo "Invalid --runner value: $RUNNER (expected host|docker|pw-container)" >&2
  exit 1
fi

if ! [[ "$RUNS" =~ ^[0-9]+$ ]] || [[ "$RUNS" -le 0 ]]; then
  echo "--runs must be a positive integer" >&2
  exit 1
fi

if ! [[ "$MAX_FAILURE_RATE" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "--max-failure-rate must be numeric (e.g. 1 or 0.5)" >&2
  exit 1
fi

if [[ "$MANAGE_STACK" == "true" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "--no-manage-stack is required when docker is unavailable." >&2
    exit 1
  fi
  echo "==> Starting stack for E2E flaky check (db/backend/frontend)"
  docker compose up -d db backend frontend
  cleanup() {
    echo "==> Stopping E2E flaky stack"
    docker compose stop backend frontend db >/dev/null 2>&1 || true
  }
  trap cleanup EXIT
fi

wait_for_url() {
  local url="$1"
  local tries="${2:-90}"
  local delay="${3:-2}"
  local code
  for _ in $(seq 1 "$tries"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    if [[ "$code" == "200" || "$code" == "304" ]]; then
      return 0
    fi
    sleep "$delay"
  done
  echo "Service not ready at $url after $tries attempts." >&2
  return 1
}

if [[ "$RUNNER" == "docker" ]]; then
  wait_for_url "http://localhost:3001/health" 90 2
  wait_for_url "${BASE_URL%/}/login" 90 2
  echo "==> Preparing frontend container runtime for E2E"
  docker compose exec -T frontend sh -lc "
    if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
      echo '==> Installing chromium in frontend container for E2E'
      apk add --no-cache chromium nss freetype harfbuzz ttf-freefont >/tmp/hms_e2e_chromium_install.log 2>&1 || {
        cat /tmp/hms_e2e_chromium_install.log >&2
        exit 1
      }
    fi
    npx playwright install chromium >/tmp/hms_e2e_playwright_install.log 2>&1 || {
      cat /tmp/hms_e2e_playwright_install.log >&2
      exit 1
    }
  "
elif [[ "$RUNNER" == "pw-container" ]]; then
  wait_for_url "http://localhost:3001/health" 90 2
  wait_for_url "${BASE_URL%/}/login" 90 2
  if ! docker image inspect "$PW_IMAGE" >/dev/null 2>&1; then
    echo "==> Pulling Playwright image: $PW_IMAGE"
    docker pull "$PW_IMAGE"
  fi
else
  wait_for_url "${BASE_URL%/}/login" 90 2
  echo "==> Installing Playwright browsers on host frontend"
  (
    cd frontend
    npx playwright install chromium chromium-headless-shell
  )
fi

failures=0
successes=0
details=()

run_once() {
  local run_index="$1"
  echo "==> E2E flaky run ${run_index}/${RUNS}"
  if [[ "$RUNNER" == "docker" ]]; then
    docker compose exec -T frontend sh -lc "
      BROWSER_BIN=\$(command -v chromium-browser || command -v chromium || true)
      if [ -z \"\$BROWSER_BIN\" ]; then
        echo 'chromium is required in frontend container for E2E (rebuild frontend image).' >&2
        exit 1
      fi
      E2E_HOTEL_ID='${E2E_HOTEL_ID_VALUE}' \
      E2E_USERNAME='${E2E_USERNAME_VALUE}' \
      E2E_PASSWORD='${E2E_PASSWORD_VALUE}' \
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=\"\$BROWSER_BIN\" \
      PLAYWRIGHT_BASE_URL='${BASE_URL}' \
      npm run test:e2e -- --grep '${GREP_PATTERN}' --fail-on-flaky-tests
    "
  elif [[ "$RUNNER" == "pw-container" ]]; then
    docker run --rm \
      --network host \
      -e E2E_HOTEL_ID="${E2E_HOTEL_ID_VALUE}" \
      -e E2E_USERNAME="${E2E_USERNAME_VALUE}" \
      -e E2E_PASSWORD="${E2E_PASSWORD_VALUE}" \
      -v "$(pwd)/frontend:/work" \
      -w /work \
      "$PW_IMAGE" \
      bash -lc "
        if [ ! -d node_modules/@playwright/test ]; then
          npm ci --include=optional
        fi
        PLAYWRIGHT_BASE_URL='${BASE_URL}' npm run test:e2e -- --grep \"${GREP_PATTERN}\" --fail-on-flaky-tests
      "
  else
    (
      cd frontend
      E2E_HOTEL_ID="${E2E_HOTEL_ID_VALUE}" \
      E2E_USERNAME="${E2E_USERNAME_VALUE}" \
      E2E_PASSWORD="${E2E_PASSWORD_VALUE}" \
      PLAYWRIGHT_BASE_URL="${BASE_URL}" npm run test:e2e -- --grep "${GREP_PATTERN}" --fail-on-flaky-tests
    )
  fi
}

for i in $(seq 1 "$RUNS"); do
  if run_once "$i"; then
    successes=$((successes + 1))
    details+=("run_${i}=PASS")
  else
    failures=$((failures + 1))
    details+=("run_${i}=FAIL")
  fi
done

failure_rate="$(awk -v f="$failures" -v n="$RUNS" 'BEGIN { printf "%.4f", (f*100.0)/n }')"
success_rate="$(awk -v s="$successes" -v n="$RUNS" 'BEGIN { printf "%.4f", (s*100.0)/n }')"

mkdir -p "$(dirname "$REPORT_FILE")"
{
  echo "# E2E Flaky Rate Report"
  echo
  echo "- runner: $RUNNER"
  echo "- base_url: $BASE_URL"
  echo "- runs: $RUNS"
  echo "- successes: $successes"
  echo "- failures: $failures"
  echo "- success_rate_pct: $success_rate"
  echo "- failure_rate_pct: $failure_rate"
  echo "- max_failure_rate_pct: $MAX_FAILURE_RATE"
  echo
  echo "## Runs"
  for line in "${details[@]}"; do
    echo "- $line"
  done
} >"$REPORT_FILE"

cat "$REPORT_FILE"

if ! awk -v rate="$failure_rate" -v max="$MAX_FAILURE_RATE" 'BEGIN { exit (rate <= max) ? 0 : 1 }'; then
  echo "e2e-flaky-rate: FAIL (failure_rate=${failure_rate}% > ${MAX_FAILURE_RATE}%)" >&2
  exit 1
fi

echo "e2e-flaky-rate: PASS (failure_rate=${failure_rate}% <= ${MAX_FAILURE_RATE}%)"
