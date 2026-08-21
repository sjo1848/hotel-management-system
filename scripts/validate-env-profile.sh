#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --profile <dev|staging|prod> --env-file <path> [--allow-placeholder-values]

Validates environment security guardrails for a specific deployment profile.
USAGE
}

PROFILE=""
ENV_FILE=""
ALLOW_PLACEHOLDER_VALUES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --allow-placeholder-values)
      ALLOW_PLACEHOLDER_VALUES=true
      shift
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

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

require_non_empty() {
  local key="$1"
  local value="${!key:-}"
  [[ -n "${value// }" ]] || fail "$key is required"
}

is_true() {
  [[ "${1,,}" == "true" ]]
}

is_positive_int() {
  [[ "$1" =~ ^[0-9]+$ ]] && [[ "$1" -gt 0 ]]
}

is_placeholder_value() {
  local normalized
  normalized="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == *"change-me"* || "$normalized" == *"replace-me"* || "$normalized" == *"example"* ]]
}

validate_secret() {
  local key="$1"
  local min_len="$2"
  local value="${!key:-}"

  require_non_empty "$key"
  [[ "${#value}" -ge "$min_len" ]] || fail "$key must be >= ${min_len} chars"
  [[ "$value" != "dev-secret-change-me" ]] || fail "$key cannot use development default"
  if [[ "$ALLOW_PLACEHOLDER_VALUES" != "true" ]] && is_placeholder_value "$value"; then
    fail "$key cannot use placeholder values in $PROFILE"
  fi
}

validate_common() {
  require_non_empty APP_ENV
  require_non_empty DATABASE_URL
  require_non_empty JWT_KID
  require_non_empty CORS_ORIGIN
  require_non_empty COOKIE_SAMESITE
  require_non_empty ACCESS_TTL_MINUTES
  require_non_empty REFRESH_TTL_DAYS

  is_true "${AUTH_REQUIRED:-}" || fail "AUTH_REQUIRED must be true"
  is_positive_int "$ACCESS_TTL_MINUTES" || fail "ACCESS_TTL_MINUTES must be a positive integer"
  is_positive_int "$REFRESH_TTL_DAYS" || fail "REFRESH_TTL_DAYS must be a positive integer"

  case "${COOKIE_SAMESITE,,}" in
    lax|strict|none) ;;
    *) fail "COOKIE_SAMESITE must be one of: Lax, Strict, None" ;;
  esac
}

validate_secure_profile() {
  require_non_empty COOKIE_DOMAIN
  [[ "${COOKIE_DOMAIN,,}" != "localhost" ]] || fail "COOKIE_DOMAIN cannot be localhost"
  [[ "$COOKIE_DOMAIN" == *.* ]] || fail "COOKIE_DOMAIN must be a registrable domain"
  [[ "${CORS_ORIGIN}" != "*" ]] || fail "CORS_ORIGIN cannot be '*'"
  is_true "${COOKIE_SECURE:-}" || fail "COOKIE_SECURE must be true in $PROFILE"
  [[ "${METRICS_PUBLIC:-false}" == "false" ]] || fail "METRICS_PUBLIC must be false in $PROFILE"

  validate_secret JWT_SECRET 32
  validate_secret ADMIN_PASSWORD 12
  [[ "${ADMIN_PASSWORD}" != "admin123" ]] || fail "ADMIN_PASSWORD cannot use dev default"
}

[[ -n "$PROFILE" ]] || fail "Missing --profile"
[[ "$PROFILE" == "dev" || "$PROFILE" == "staging" || "$PROFILE" == "prod" ]] || fail "--profile must be dev|staging|prod"
[[ -n "$ENV_FILE" ]] || fail "Missing --env-file"
[[ -f "$ENV_FILE" ]] || fail "File not found: $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ "$PROFILE" == "dev" ]]; then
  : "${APP_ENV:=dev}"
  : "${AUTH_REQUIRED:=true}"
  : "${JWT_KID:=v1}"
  : "${CORS_ORIGIN:=http://localhost:5173}"
  : "${COOKIE_SAMESITE:=Lax}"
  : "${ACCESS_TTL_MINUTES:=15}"
  : "${REFRESH_TTL_DAYS:=7}"
fi

validate_common

normalized_app_env="${APP_ENV,,}"
case "$PROFILE" in
  dev)
    [[ "$normalized_app_env" == "dev" || "$normalized_app_env" == "development" || "$normalized_app_env" == "local" ]] || \
      fail "APP_ENV for dev profile must be dev/development/local"
    ;;
  staging)
    [[ "$normalized_app_env" == "staging" ]] || fail "APP_ENV for staging profile must be staging"
    validate_secure_profile
    ;;
  prod)
    [[ "$normalized_app_env" == "prod" || "$normalized_app_env" == "production" ]] || \
      fail "APP_ENV for prod profile must be prod/production"
    normalized_database_url="${DATABASE_URL,,}"
    [[ "$normalized_database_url" != *"@db:"* ]] || fail "DATABASE_URL cannot use dev Docker hostname @db: in prod"
    [[ "$normalized_database_url" != *"localhost"* ]] || fail "DATABASE_URL cannot use localhost in prod"
    validate_secure_profile
    ;;
esac

echo "[OK] ${PROFILE} env validation passed for ${ENV_FILE}"
