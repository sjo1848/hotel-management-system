#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root."
  exit 1
fi

RUNNER="pw-container"
PW_IMAGE="${HMS_E2E_PW_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"
BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:5173}"
E2E_HOTEL_ID="${E2E_HOTEL_ID:-00000000-0000-0000-0000-000000000001}"
E2E_USERNAME="${E2E_USERNAME:-admin}"
E2E_PASSWORD="${E2E_PASSWORD:-admin123}"
GREP_PATTERN="${E2E_GREP:-journey|lifecycle|billing|rbac}"
ORIGINAL_RATE_LIMIT_PER_MINUTE="${RATE_LIMIT_PER_MINUTE:-60}"
E2E_RATE_LIMIT_PER_MINUTE="${E2E_RATE_LIMIT_PER_MINUTE:-600}"
MANAGED_SERVICES=(db tempo otel-collector backend frontend)
STARTED_SERVICES=()

for service in "${MANAGED_SERVICES[@]}"; do
  if ! docker compose ps --status running --services | grep -qx "$service"; then
    STARTED_SERVICES+=("$service")
  fi
done

usage() {
  cat <<USAGE
Usage: $0 [--runner host|docker|pw-container]

Options:
  --runner MODE   host, docker, or pw-container (default)
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

if [[ "$RUNNER" != "host" && "$RUNNER" != "docker" && "$RUNNER" != "pw-container" ]]; then
  echo "Invalid --runner value: $RUNNER (expected host|docker|pw-container)" >&2
  exit 1
fi

wait_for_stack_url() {
  local url="$1"
  local tries="${2:-60}"
  local delay="${3:-2}"

  docker compose exec -T frontend node - "$url" "$tries" "$delay" <<'NODE'
const [url, triesArg, delayArg] = process.argv.slice(2);
const tries = Number.parseInt(triesArg, 10);
const delayMs = Number.parseInt(delayArg, 10) * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.status === 200 || response.status === 304) {
        process.exit(0);
      }
    } catch {}

    await sleep(delayMs);
  }

  console.error(`Service not ready at ${url} after ${tries} attempts.`);
  process.exit(1);
}

main();
NODE
}

echo "==> Starting stack for browser E2E (db/backend/frontend)"
RATE_LIMIT_PER_MINUTE="$E2E_RATE_LIMIT_PER_MINUTE" docker compose up -d db backend frontend

cleanup() {
  if [[ "$E2E_RATE_LIMIT_PER_MINUTE" != "$ORIGINAL_RATE_LIMIT_PER_MINUTE" ]]; then
    echo "==> Restoring backend rate limit"
    RATE_LIMIT_PER_MINUTE="$ORIGINAL_RATE_LIMIT_PER_MINUTE" docker compose up -d backend >/dev/null 2>&1 || true
  fi
  if [[ "${#STARTED_SERVICES[@]}" -gt 0 ]]; then
    echo "==> Restoring services started by browser E2E"
    docker compose stop "${STARTED_SERVICES[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> Waiting for backend"
wait_for_stack_url "http://backend:3001/health" 90 2

echo "==> Waiting for frontend"
wait_for_stack_url "http://frontend:5173/login" 90 2

echo "==> Running Playwright core journeys"
if [[ "$RUNNER" == "docker" ]]; then
  docker compose exec -T \
    -e E2E_HOTEL_ID="$E2E_HOTEL_ID" \
    -e E2E_USERNAME="$E2E_USERNAME" \
    -e E2E_PASSWORD="$E2E_PASSWORD" \
    -e E2E_GREP="$GREP_PATTERN" \
    frontend sh -lc '
    if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
      echo "==> Installing chromium in frontend container for E2E"
      apk add --no-cache chromium nss freetype harfbuzz ttf-freefont >/tmp/hms_e2e_chromium_install.log 2>&1 || {
        cat /tmp/hms_e2e_chromium_install.log >&2
        exit 1
      }
    fi
    if command -v chromium-browser >/dev/null 2>&1; then
      BROWSER_BIN="$(command -v chromium-browser)"
    elif command -v chromium >/dev/null 2>&1; then
      BROWSER_BIN="$(command -v chromium)"
    else
      echo "chromium is required in frontend container for E2E." >&2
      exit 1
    fi
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$BROWSER_BIN" \
    PLAYWRIGHT_BASE_URL="http://127.0.0.1:5173" \
      npx playwright test --grep "$E2E_GREP" --fail-on-flaky-tests
  '
elif [[ "$RUNNER" == "pw-container" ]]; then
  if ! docker image inspect "$PW_IMAGE" >/dev/null 2>&1; then
    echo "==> Pulling Playwright image: $PW_IMAGE"
    docker pull "$PW_IMAGE"
  fi
  docker run --rm \
    --network host \
    -e PLAYWRIGHT_BASE_URL="$BASE_URL" \
    -e E2E_HOTEL_ID="$E2E_HOTEL_ID" \
    -e E2E_USERNAME="$E2E_USERNAME" \
    -e E2E_PASSWORD="$E2E_PASSWORD" \
    -e E2E_GREP="$GREP_PATTERN" \
    -v "$(pwd)/frontend:/work" \
    -w /work \
    "$PW_IMAGE" \
    bash -lc '
      if [ ! -d node_modules/@playwright/test ]; then
        npm ci --include=optional
      fi
      npm run test:e2e -- --grep "$E2E_GREP" --fail-on-flaky-tests
    '
else
  (
    cd frontend
    npx playwright install chromium chromium-headless-shell
    PLAYWRIGHT_BASE_URL="$BASE_URL" \
    E2E_HOTEL_ID="$E2E_HOTEL_ID" \
    E2E_USERNAME="$E2E_USERNAME" \
    E2E_PASSWORD="$E2E_PASSWORD" \
      npm run test:e2e -- --grep "$GREP_PATTERN" --fail-on-flaky-tests
  )
fi

echo "==> HMS-QA-010 browser E2E core journeys: PASS"
