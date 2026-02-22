#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --base-url URL        Backend base URL (default: http://localhost:3001)
  --env-file PATH       Env file for synthetic credentials (default: .env)
  --hotel-id VALUE      Hotel id/name for login (default: SYNTHETIC_HOTEL_ID or Hotel Sede Central)
  --username VALUE      Username for login (default: ADMIN_USER or admin)
  --password VALUE      Password for login (default: ADMIN_PASSWORD or admin123)
  -h, --help            Show this help
USAGE
}

BASE_URL="http://localhost:3001"
ENV_FILE=".env"
HOTEL_ID=""
USERNAME=""
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --hotel-id) HOTEL_ID="$2"; shift 2 ;;
    --username) USERNAME="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "$HOTEL_ID" ]]; then
  HOTEL_ID="${SYNTHETIC_HOTEL_ID:-Hotel Sede Central}"
fi
if [[ -z "$USERNAME" ]]; then
  USERNAME="${ADMIN_USER:-admin}"
fi
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="${ADMIN_PASSWORD:-admin123}"
fi

API_BASE="${BASE_URL%/}/api/v1"
COOKIE_FILE="$(mktemp)"
LOGIN_BODY_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE" "$LOGIN_BODY_FILE"' EXIT

echo "🧪 Iniciando Smoke Test..."

echo -n "[1/5] Verificando salud del sistema... "
health_ok=false
for _ in $(seq 1 20); do
  if curl -fsS "${BASE_URL%/}/health" | grep -q "operational"; then
    health_ok=true
    break
  fi
  sleep 1
done
if [[ "$health_ok" != true ]]; then
  echo "❌"
  exit 1
fi
echo "✅"

echo -n "[2/5] Intentando Login (${USERNAME})... "
LOGIN_RES="$(
  curl -sS -c "$COOKIE_FILE" -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"hotel_id\":\"$HOTEL_ID\",\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
    -o "$LOGIN_BODY_FILE" \
    -w "%{http_code}"
)"
if [[ "$LOGIN_RES" != "200" ]]; then
  echo "❌"
  echo "HTTP: $LOGIN_RES"
  echo "Respuesta: $(cat "$LOGIN_BODY_FILE")"
  exit 1
fi
ACCESS_TOKEN="$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' "$LOGIN_BODY_FILE")"
if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "❌"
  echo "No se recibió access_token"
  exit 1
fi
echo "✅"

echo -n "[3/5] Verificando perfil de usuario... "
ME_CODE="$(
  curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" "$API_BASE/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
)"
if [[ "$ME_CODE" == "200" ]] && grep -q "$USERNAME" "$LOGIN_BODY_FILE"; then
  echo "✅"
else
  echo "❌"
  echo "HTTP: $ME_CODE"
  echo "Respuesta: $(cat "$LOGIN_BODY_FILE")"
  exit 1
fi

echo -n "[4/5] Listando habitaciones... "
ROOMS_CODE="$(
  curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" "$API_BASE/rooms" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
)"
if [[ "$ROOMS_CODE" == "200" ]]; then
  echo "✅"
else
  echo "❌"
  echo "HTTP: $ROOMS_CODE"
  echo "Respuesta: $(cat "$LOGIN_BODY_FILE")"
  exit 1
fi

echo -n "[5/5] Intentando Logout seguro... "
CSRF_TOKEN="$(awk '$1 !~ /^#/ && $6 == "csrf_token" { token = $7 } END { if (token != "") print token }' "$COOKIE_FILE")"
if [[ -n "$CSRF_TOKEN" ]]; then
  LOGOUT_CODE="$(
    curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" -X POST "$API_BASE/auth/logout" \
      -H "Content-Type: application/json" \
      -H "x-csrf-token: $CSRF_TOKEN" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -b "$COOKIE_FILE" \
      -d '{}'
  )"
else
  LOGOUT_CODE="$(
    curl -sS -o "$LOGIN_BODY_FILE" -w "%{http_code}" -X POST "$API_BASE/auth/logout" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -d '{}'
  )"
fi
if [[ "$LOGOUT_CODE" == "200" ]] && grep -q "ok" "$LOGIN_BODY_FILE"; then
  echo "✅"
elif [[ "${COOKIE_SECURE:-false}" == "true" ]] && [[ "${BASE_URL}" == http://* ]] && grep -q "CSRF token inválido" "$LOGIN_BODY_FILE"; then
  echo "⚠️ (omitido por cookies Secure sobre HTTP local)"
else
  echo "❌"
  echo "HTTP: $LOGOUT_CODE"
  echo "Respuesta: $(cat "$LOGIN_BODY_FILE")"
  exit 1
fi

echo
echo "🎉 SMOKE TEST PASADO EXITOSAMENTE"
