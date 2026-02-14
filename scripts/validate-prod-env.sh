#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --env-file .env.prod

Validates production-safe environment values for HMS backend.
USAGE
}

ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$ENV_FILE" ]]; then
  echo "Missing --env-file" >&2
  usage
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "File not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

[[ "${APP_ENV:-}" == "prod" || "${APP_ENV:-}" == "production" ]] || fail "APP_ENV must be prod/production"
[[ "${AUTH_REQUIRED:-}" == "true" ]] || fail "AUTH_REQUIRED must be true"
[[ -n "${JWT_SECRET:-}" ]] || fail "JWT_SECRET is required"
[[ ${#JWT_SECRET} -ge 32 ]] || fail "JWT_SECRET must be >= 32 chars"
[[ "${JWT_SECRET:-}" != "dev-secret-change-me" ]] || fail "JWT_SECRET cannot use dev default"
[[ -n "${JWT_KID:-}" ]] || fail "JWT_KID is required"
[[ -n "${ADMIN_PASSWORD:-}" ]] || fail "ADMIN_PASSWORD is required"
[[ "${ADMIN_PASSWORD:-}" != "admin123" ]] || fail "ADMIN_PASSWORD cannot use dev default"
[[ "${COOKIE_SECURE:-}" == "true" ]] || fail "COOKIE_SECURE must be true"
[[ -n "${COOKIE_DOMAIN:-}" ]] || fail "COOKIE_DOMAIN is required"
[[ "${COOKIE_DOMAIN:-}" != "localhost" ]] || fail "COOKIE_DOMAIN cannot be localhost"
[[ "${COOKIE_DOMAIN:-}" == *.* ]] || fail "COOKIE_DOMAIN must be a registrable domain"
[[ -n "${CORS_ORIGIN:-}" ]] || fail "CORS_ORIGIN is required"
[[ "${CORS_ORIGIN:-}" != "*" ]] || fail "CORS_ORIGIN cannot be *"
[[ "${METRICS_PUBLIC:-false}" == "false" ]] || fail "METRICS_PUBLIC must be false in production"

echo "[OK] Production env validation passed for $ENV_FILE"
