#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://hms-frontend:5173}" \
E2E_HOTEL_ID="${E2E_HOTEL_ID:-00000000-0000-0000-0000-000000000001}" \
E2E_USERNAME="${E2E_USERNAME:-recepcion_demo}" \
E2E_PASSWORD="${E2E_PASSWORD:-demo2026pass}" \
E2E_GREP="${E2E_GREP:-reception role smoke}" \
./scripts/playwright-smoke.sh
