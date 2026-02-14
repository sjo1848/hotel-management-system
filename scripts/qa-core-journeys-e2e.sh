#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root."
  exit 1
fi

RUNNER="host"

usage() {
  cat <<USAGE
Usage: $0 [--runner host|docker]

Options:
  --runner MODE   host (default, CI mode) or docker (run Playwright inside frontend container)
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
  echo "==> Installing Playwright browsers in frontend container"
  docker compose exec -T frontend npx playwright install chromium chromium-headless-shell
  docker compose exec -T frontend sh -lc '
    npx playwright test --grep "journey|lifecycle|billing|rbac"
  '
else
  (
    cd frontend
    npx playwright install chromium chromium-headless-shell
    PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5173}" \
      npm run test:e2e -- --grep "journey|lifecycle|billing|rbac"
  )
fi

echo "==> HMS-QA-010 browser E2E core journeys: PASS"
