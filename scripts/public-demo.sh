#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd docker
require_cmd openssl
require_cmd curl

ADMIN_USER="${ADMIN_USER:-admin}"
HOTEL_ID="${HOTEL_ID:-00000000-0000-0000-0000-000000000001}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 24 | tr -d '\n')}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 | tr -d '\n')}"
COOKIE_SECURE="${COOKIE_SECURE:-true}"
APP_ENV="${APP_ENV:-staging}"
TUNNEL_IMAGE="${TUNNEL_IMAGE:-cloudflare/cloudflared:latest}"

echo "Preparing public demo environment..."
echo "  admin_user: $ADMIN_USER"
echo "  hotel_id:   $HOTEL_ID"

JWT_SECRET="$JWT_SECRET" \
COOKIE_SECURE="$COOKIE_SECURE" \
APP_ENV="$APP_ENV" \
ADMIN_USER="$ADMIN_USER" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
docker compose up -d --force-recreate backend frontend >/dev/null

echo "Waiting for backend health..."
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:3001/health >/dev/null 2>&1; then
  echo "Backend did not become healthy on :3001" >&2
  exit 1
fi

echo "Generating password hash inside backend container..."
ADMIN_HASH="$(docker compose exec -T backend cargo run --quiet --bin hash_password -- "$ADMIN_PASSWORD" | tr -d '\r\n')"

echo "Rotating demo admin password in database..."
docker compose exec -T db psql -U "${POSTGRES_USER:-admin}" -d "${POSTGRES_DB:-hms_core}" \
  -v ON_ERROR_STOP=1 \
  -c "UPDATE users SET password_hash = '$ADMIN_HASH' WHERE hotel_id = '$HOTEL_ID'::uuid AND username = '$ADMIN_USER';" >/dev/null

echo
echo "Public demo credentials"
echo "  URL:       tunnel output below"
echo "  Username:  $ADMIN_USER"
echo "  Password:  $ADMIN_PASSWORD"
echo "  Hotel ID:  $HOTEL_ID"
echo
echo "Starting Cloudflare quick tunnel. Keep this process running."
echo

exec docker run --rm --network host "$TUNNEL_IMAGE" tunnel --url http://127.0.0.1:5173 --no-autoupdate
