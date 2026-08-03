#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://hms-frontend:5173}"
E2E_HOTEL_ID="${E2E_HOTEL_ID:-00000000-0000-0000-0000-000000000001}"
E2E_USERNAME="${E2E_USERNAME:-admin}"
E2E_PASSWORD="${E2E_PASSWORD:-demo2026pass}"
GREP_PATTERN="${E2E_GREP:-journey|lifecycle|billing|rbac}"
MANAGED_SERVICES=(db tempo otel-collector backend frontend)
STARTED_SERVICES=()

for service in "${MANAGED_SERVICES[@]}"; do
  if ! docker compose ps --status running --services | grep -qx "$service"; then
    STARTED_SERVICES+=("$service")
  fi
done

wait_for_stack_url() {
  local url="$1"
  local tries="${2:-90}"
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

echo "==> Starting stack for Playwright smoke (db/backend/frontend)"
docker compose up -d db backend frontend

cleanup() {
  if [[ "${#STARTED_SERVICES[@]}" -gt 0 ]]; then
    echo "==> Restoring services started by Playwright smoke"
    docker compose stop "${STARTED_SERVICES[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> Waiting for backend"
wait_for_stack_url "http://backend:3001/health" 90 2

echo "==> Waiting for frontend"
wait_for_stack_url "http://frontend:5173/login" 90 2

echo "==> Running Playwright smoke in compose service"
docker compose --profile qa run --rm playwright bash -lc "
  if [ ! -d node_modules/@playwright/test ]; then
    npm ci --include=optional
  fi
  PLAYWRIGHT_BASE_URL='${BASE_URL}' \
  E2E_HOTEL_ID='${E2E_HOTEL_ID}' \
  E2E_USERNAME='${E2E_USERNAME}' \
  E2E_PASSWORD='${E2E_PASSWORD}' \
  npm run test:e2e -- --grep '${GREP_PATTERN}' --fail-on-flaky-tests
"

echo "==> Playwright smoke: PASS"
