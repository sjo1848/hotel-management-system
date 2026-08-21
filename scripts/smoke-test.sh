#!/usr/bin/env bash
# Synthetic authenticated smoke; credentials and tenant are always injected.
set -euo pipefail
FRONTEND_PORT="${SMOKE_FRONTEND_PORT:-${FRONTEND_PORT:-5173}}"
BASE_URL="${SMOKE_BASE_URL:-${BASE_URL:-http://localhost:${FRONTEND_PORT}}}"; API_BASE="${API_BASE:-${BASE_URL}/api/v1}"
if [[ "${APP_ENV:-dev}" =~ ^(prod|production)$ ]]; then
  [[ -n "${SMOKE_BASE_URL:-}" ]] || { echo "SMOKE_BASE_URL is required in production" >&2; exit 1; }
fi
SMOKE_HOTEL_ID="${SMOKE_HOTEL_ID:?SMOKE_HOTEL_ID is required}"; SMOKE_USERNAME="${SMOKE_USERNAME:?SMOKE_USERNAME is required}"; SMOKE_PASSWORD="${SMOKE_PASSWORD:?SMOKE_PASSWORD is required}"
COOKIE_FILE="${SMOKE_COOKIE_FILE:-$(mktemp)}"; trap 'rm -f "$COOKIE_FILE"' EXIT
curl -fsS "$BASE_URL/health" | grep -q operational
login="$(curl -fsS -c "$COOKIE_FILE" -X POST "$API_BASE/auth/login" -H 'Content-Type: application/json' -d "{\"hotel_id\":\"${SMOKE_HOTEL_ID}\",\"username\":\"${SMOKE_USERNAME}\",\"password\":\"${SMOKE_PASSWORD}\"}")"
echo "$login" | grep -q access_token
curl -fsS -b "$COOKIE_FILE" "$API_BASE/auth/me" >/dev/null
curl -fsS -b "$COOKIE_FILE" "$API_BASE/rooms" >/dev/null
csrf="$(awk '$6 == "csrf_token" { print $7 }' "$COOKIE_FILE" | tail -n1)"; [[ -n "$csrf" ]] || { echo "Missing CSRF cookie" >&2; exit 1; }
curl -fsS -b "$COOKIE_FILE" -X POST "$API_BASE/auth/logout" -H "x-csrf-token: $csrf" -H 'Content-Type: application/json' -d '{}' | grep -q ok
echo "Smoke test PASS (synthetic injected identity)"
