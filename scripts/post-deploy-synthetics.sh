#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Runs post-deploy synthetic checks and writes a markdown report.

Options:
  --base-url URL            Backend base URL (default: http://localhost:3001)
  --api-base-url URL        API base URL (default: <base-url>/api/v1)
  --env-file PATH           Env file to source credentials/profile context (default: .env)
  --profile MODE            auto|dev|staging|prod (default: auto)
  --hotel-id VALUE          Hotel id/name for synthetic login (default: SYNTHETIC_HOTEL_ID env or dev fallback)
  --username VALUE          Synthetic username (default: ADMIN_USER from env file)
  --password VALUE          Synthetic password (default: ADMIN_PASSWORD from env file)
  --skip-auth-flow          Skip authenticated synthetic flow (health/docs checks still run)
  --curl-timeout SEC        Curl timeout per request in seconds (default: 15)
  --report PATH             Markdown report path (default: /tmp/hms_post_deploy_synthetics.md)
  -h, --help                Show this help
USAGE
}

BASE_URL="http://localhost:3001"
API_BASE_URL=""
ENV_FILE=".env"
PROFILE="auto"
HOTEL_ID=""
USERNAME=""
PASSWORD=""
SKIP_AUTH_FLOW=false
CURL_TIMEOUT=15
REPORT_FILE="/tmp/hms_post_deploy_synthetics.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --api-base-url) API_BASE_URL="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --hotel-id) HOTEL_ID="$2"; shift 2 ;;
    --username) USERNAME="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --skip-auth-flow) SKIP_AUTH_FLOW=true; shift ;;
    --curl-timeout) CURL_TIMEOUT="$2"; shift 2 ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$PROFILE" != "auto" && "$PROFILE" != "dev" && "$PROFILE" != "staging" && "$PROFILE" != "prod" ]]; then
  echo "--profile must be auto|dev|staging|prod" >&2
  exit 1
fi

if ! [[ "$CURL_TIMEOUT" =~ ^[0-9]+$ ]] || [[ "$CURL_TIMEOUT" -le 0 ]]; then
  echo "--curl-timeout must be a positive integer" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

resolve_profile() {
  if [[ "$PROFILE" != "auto" ]]; then
    echo "$PROFILE"
    return
  fi

  local app_env
  app_env="$(echo "${APP_ENV:-dev}" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
  case "$app_env" in
    prod|production) echo "prod" ;;
    staging) echo "staging" ;;
    *) echo "dev" ;;
  esac
}

is_placeholder() {
  local value
  value="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == *"change-me"* || "$value" == *"replace-me"* || "$value" == *"example"* ]]
}

contains_code() {
  local code="$1"
  local expected_csv="$2"
  local candidate
  IFS=',' read -r -a expected <<<"$expected_csv"
  for candidate in "${expected[@]}"; do
    if [[ "$code" == "$candidate" ]]; then
      return 0
    fi
  done
  return 1
}

RUNTIME_PROFILE="$(resolve_profile)"
if [[ -z "$API_BASE_URL" ]]; then
  API_BASE_URL="${BASE_URL%/}/api/v1"
fi

if [[ -z "$USERNAME" ]]; then
  USERNAME="${ADMIN_USER:-}"
fi
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="${ADMIN_PASSWORD:-}"
fi
if [[ -z "$HOTEL_ID" ]]; then
  HOTEL_ID="${SYNTHETIC_HOTEL_ID:-}"
fi
if [[ -z "$HOTEL_ID" && "$RUNTIME_PROFILE" == "dev" ]]; then
  HOTEL_ID="Hotel Sede Central"
fi

generated_at_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
host_name="$(hostname)"

CHECK_LINES=()
FAILED_COUNT=0

record_check() {
  local name="$1"
  local status="$2"
  local code="$3"
  local duration="$4"
  local notes="$5"
  CHECK_LINES+=("| ${name} | ${status} | ${code} | ${duration} | ${notes} |")
  if [[ "$status" == "FAIL" ]]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

run_http_check() {
  local name="$1"
  local method="$2"
  local url="$3"
  local expected_codes="$4"
  local body_pattern="${5:-}"
  local body_file
  local err_file
  local code
  local duration
  body_file="$(mktemp)"
  err_file="$(mktemp)"

  code="$(
    curl -sS \
      --max-time "$CURL_TIMEOUT" \
      -X "$method" \
      -o "$body_file" \
      -w "%{http_code}|%{time_total}" \
      "$url" 2>"$err_file" || true
  )"
  duration="$(echo "$code" | awk -F'|' '{print $2 "s"}')"
  code="$(echo "$code" | awk -F'|' '{print $1}')"

  if [[ -z "$code" || "$code" == "000" ]]; then
    record_check "$name" "FAIL" "${code:-000}" "${duration:-n/a}" "$(tr '\n' ' ' <"$err_file" | sed 's/|/-/g')"
    rm -f "$body_file" "$err_file"
    return
  fi

  if ! contains_code "$code" "$expected_codes"; then
    record_check "$name" "FAIL" "$code" "$duration" "unexpected_status expected=${expected_codes}"
    rm -f "$body_file" "$err_file"
    return
  fi

  if [[ -n "$body_pattern" ]] && ! grep -q "$body_pattern" "$body_file"; then
    record_check "$name" "FAIL" "$code" "$duration" "missing_body_pattern=${body_pattern}"
    rm -f "$body_file" "$err_file"
    return
  fi

  record_check "$name" "PASS" "$code" "$duration" "ok"
  rm -f "$body_file" "$err_file"
}

COOKIE_FILE="$(mktemp)"
LOGIN_BODY="$(mktemp)"
ME_BODY="$(mktemp)"
ROOMS_BODY="$(mktemp)"
LOGOUT_BODY="$(mktemp)"
cleanup() {
  rm -f "$COOKIE_FILE" "$LOGIN_BODY" "$ME_BODY" "$ROOMS_BODY" "$LOGOUT_BODY"
}
trap cleanup EXIT

run_http_check "health" "GET" "${BASE_URL%/}/health" "200" "operational"
run_http_check "ready" "GET" "${BASE_URL%/}/ready" "200" "ready"
run_http_check "openapi_docs" "GET" "${BASE_URL%/}/api-docs/openapi.json" "200" "\"openapi\""

if [[ "$SKIP_AUTH_FLOW" == "true" ]]; then
  record_check "auth_flow" "SKIP" "-" "-" "skipped_by_flag"
else
  if [[ -z "$USERNAME" || -z "$PASSWORD" || -z "$HOTEL_ID" ]]; then
    record_check "auth_flow" "FAIL" "-" "-" "missing_auth_inputs(username/password/hotel_id)"
  else
    if [[ "$RUNTIME_PROFILE" != "dev" ]]; then
      if [[ "$PASSWORD" == "admin123" ]] || is_placeholder "$PASSWORD"; then
        record_check "auth_flow" "FAIL" "-" "-" "insecure_or_placeholder_password_for_${RUNTIME_PROFILE}"
      fi
      if is_placeholder "$HOTEL_ID"; then
        record_check "auth_flow" "FAIL" "-" "-" "placeholder_hotel_id_for_${RUNTIME_PROFILE}"
      fi
    fi

    if [[ "$FAILED_COUNT" -eq 0 ]]; then
      login_payload="$(printf '{"hotel_id":"%s","username":"%s","password":"%s"}' "$HOTEL_ID" "$USERNAME" "$PASSWORD")"
      login_result="$(
        curl -sS \
          --max-time "$CURL_TIMEOUT" \
          -X POST \
          -H "Content-Type: application/json" \
          -c "$COOKIE_FILE" \
          -d "$login_payload" \
          -o "$LOGIN_BODY" \
          -w "%{http_code}|%{time_total}" \
          "${API_BASE_URL%/}/auth/login" || true
      )"
      login_code="$(echo "$login_result" | awk -F'|' '{print $1}')"
      login_duration="$(echo "$login_result" | awk -F'|' '{print $2 "s"}')"

      if [[ "$login_code" != "200" ]] || ! grep -q "access_token" "$LOGIN_BODY"; then
        record_check "auth_login" "FAIL" "${login_code:-000}" "${login_duration:-n/a}" "login_failed"
      else
        record_check "auth_login" "PASS" "$login_code" "$login_duration" "ok"
        access_token="$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' "$LOGIN_BODY")"

        if [[ -n "$access_token" ]]; then
          me_result="$(
            curl -sS \
              --max-time "$CURL_TIMEOUT" \
              -b "$COOKIE_FILE" \
              -H "Authorization: Bearer ${access_token}" \
              -o "$ME_BODY" \
              -w "%{http_code}|%{time_total}" \
              "${API_BASE_URL%/}/auth/me" || true
          )"
        else
          me_result="$(
            curl -sS \
              --max-time "$CURL_TIMEOUT" \
              -b "$COOKIE_FILE" \
              -o "$ME_BODY" \
              -w "%{http_code}|%{time_total}" \
              "${API_BASE_URL%/}/auth/me" || true
          )"
        fi
        me_code="$(echo "$me_result" | awk -F'|' '{print $1}')"
        me_duration="$(echo "$me_result" | awk -F'|' '{print $2 "s"}')"
        if [[ "$me_code" != "200" ]] || ! grep -q "$USERNAME" "$ME_BODY"; then
          record_check "auth_me" "FAIL" "${me_code:-000}" "${me_duration:-n/a}" "auth_me_failed"
        else
          record_check "auth_me" "PASS" "$me_code" "$me_duration" "ok"
        fi

        if [[ -n "$access_token" ]]; then
          rooms_result="$(
            curl -sS \
              --max-time "$CURL_TIMEOUT" \
              -b "$COOKIE_FILE" \
              -H "Authorization: Bearer ${access_token}" \
              -o "$ROOMS_BODY" \
              -w "%{http_code}|%{time_total}" \
              "${API_BASE_URL%/}/rooms" || true
          )"
        else
          rooms_result="$(
            curl -sS \
              --max-time "$CURL_TIMEOUT" \
              -b "$COOKIE_FILE" \
              -o "$ROOMS_BODY" \
              -w "%{http_code}|%{time_total}" \
              "${API_BASE_URL%/}/rooms" || true
          )"
        fi
        rooms_code="$(echo "$rooms_result" | awk -F'|' '{print $1}')"
        rooms_duration="$(echo "$rooms_result" | awk -F'|' '{print $2 "s"}')"
        if [[ "$rooms_code" != "200" ]]; then
          record_check "rooms_list" "FAIL" "${rooms_code:-000}" "${rooms_duration:-n/a}" "rooms_query_failed"
        else
          record_check "rooms_list" "PASS" "$rooms_code" "$rooms_duration" "ok"
        fi

        csrf_token="$(awk '$6 == "csrf_token" {print $7}' "$COOKIE_FILE" | tail -n 1)"
        if [[ -n "$csrf_token" ]]; then
          if [[ -n "$access_token" ]]; then
            logout_result="$(
              curl -sS \
                --max-time "$CURL_TIMEOUT" \
                -X POST \
                -H "Content-Type: application/json" \
                -H "x-csrf-token: ${csrf_token}" \
                -H "Authorization: Bearer ${access_token}" \
                -b "$COOKIE_FILE" \
                -d '{}' \
                -o "$LOGOUT_BODY" \
                -w "%{http_code}|%{time_total}" \
                "${API_BASE_URL%/}/auth/logout" || true
            )"
          else
            logout_result="$(
              curl -sS \
                --max-time "$CURL_TIMEOUT" \
                -X POST \
                -H "Content-Type: application/json" \
                -H "x-csrf-token: ${csrf_token}" \
                -b "$COOKIE_FILE" \
                -d '{}' \
                -o "$LOGOUT_BODY" \
                -w "%{http_code}|%{time_total}" \
                "${API_BASE_URL%/}/auth/logout" || true
            )"
          fi
        elif [[ -n "$access_token" ]]; then
          logout_result="$(
            curl -sS \
              --max-time "$CURL_TIMEOUT" \
              -X POST \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer ${access_token}" \
              -d '{}' \
              -o "$LOGOUT_BODY" \
              -w "%{http_code}|%{time_total}" \
              "${API_BASE_URL%/}/auth/logout" || true
          )"
        else
          logout_result=""
          record_check "auth_logout" "SKIP" "-" "-" "csrf_and_access_token_missing"
        fi

        if [[ -n "$logout_result" ]]; then
          logout_code="$(echo "$logout_result" | awk -F'|' '{print $1}')"
          logout_duration="$(echo "$logout_result" | awk -F'|' '{print $2 "s"}')"
          if [[ "$logout_code" != "200" ]] || ! grep -q "ok" "$LOGOUT_BODY"; then
            if [[ "${COOKIE_SECURE:-false}" == "true" ]] && [[ "${BASE_URL}" == http://* ]] && grep -q "CSRF token inválido" "$LOGOUT_BODY"; then
              record_check "auth_logout" "SKIP" "${logout_code:-000}" "${logout_duration:-n/a}" "secure_cookie_over_http_local"
            else
              record_check "auth_logout" "FAIL" "${logout_code:-000}" "${logout_duration:-n/a}" "logout_failed"
            fi
          else
            record_check "auth_logout" "PASS" "$logout_code" "$logout_duration" "ok"
          fi
        fi
      fi
    fi
  fi
fi

mkdir -p "$(dirname "$REPORT_FILE")"
{
  echo "# Post-Deploy Synthetics"
  echo
  echo "- generated_at_utc: ${generated_at_utc}"
  echo "- runner: ${host_name}"
  echo "- profile: ${RUNTIME_PROFILE}"
  echo "- base_url: ${BASE_URL}"
  echo "- api_base_url: ${API_BASE_URL}"
  echo "- env_file: ${ENV_FILE}"
  echo
  echo "## Results"
  echo
  echo "| Check | Result | HTTP | Duration | Notes |"
  echo "| --- | --- | --- | --- | --- |"
  for line in "${CHECK_LINES[@]}"; do
    echo "${line}"
  done
  echo
  if [[ "$FAILED_COUNT" -eq 0 ]]; then
    echo "- overall_result: PASS"
  else
    echo "- overall_result: FAIL"
    echo "- failed_checks: ${FAILED_COUNT}"
  fi
} >"$REPORT_FILE"

cat "$REPORT_FILE"
echo
echo "Report written to: $REPORT_FILE"

if [[ "$FAILED_COUNT" -ne 0 ]]; then
  exit 1
fi
