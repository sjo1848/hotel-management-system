#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root."
  exit 1
fi

RUNNER="pw-container"
PW_IMAGE="${HMS_E2E_PW_IMAGE:-mcr.microsoft.com/playwright:v1.58.2-noble}"

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

wait_for_url() {
  local url="$1"
  local tries="${2:-60}"
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

echo "==> Starting stack for browser E2E (db/backend/frontend)"
docker compose up -d db backend frontend

cleanup() {
  echo "==> Stopping E2E stack"
  docker compose stop backend frontend db >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Waiting for backend"
wait_for_url "http://localhost:3001/health" 90 2

echo "==> Waiting for frontend"
wait_for_url "http://localhost:5173/login" 90 2

echo "==> Running Playwright core journeys"
if [[ "$RUNNER" == "docker" ]]; then
  docker compose exec -T frontend sh -lc '
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
      npx playwright test --grep "journey|lifecycle|billing|rbac" --fail-on-flaky-tests
  '
elif [[ "$RUNNER" == "pw-container" ]]; then
  if ! docker image inspect "$PW_IMAGE" >/dev/null 2>&1; then
    echo "==> Pulling Playwright image: $PW_IMAGE"
    docker pull "$PW_IMAGE"
  fi
  docker run --rm \
    --network host \
    -v "$(pwd)/frontend:/work" \
    -w /work \
    "$PW_IMAGE" \
    bash -lc '
      if [ ! -d node_modules/@playwright/test ]; then
        npm ci --include=optional
      fi
      PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}" \
        npm run test:e2e -- --grep "journey|lifecycle|billing|rbac" --fail-on-flaky-tests
    '
else
  (
    cd frontend
    npx playwright install chromium chromium-headless-shell
    PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}" \
      npm run test:e2e -- --grep "journey|lifecycle|billing|rbac" --fail-on-flaky-tests
  )
fi

echo "==> HMS-QA-010 browser E2E core journeys: PASS"
