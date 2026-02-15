#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--env-file PATH] [--profile auto|dev|staging|prod]

Executes a rollback drill by invoking deploy-with-rollback against an invalid ref.
Expected behavior: deploy script fails, rollback restores previous commit and service health.
USAGE
}

ENV_FILE=".env"
PROFILE="auto"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$PROFILE" != "auto" && "$PROFILE" != "dev" && "$PROFILE" != "staging" && "$PROFILE" != "prod" ]]; then
  echo "--profile must be auto|dev|staging|prod" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "env file not found: $ENV_FILE" >&2
  exit 1
fi

PREV_HEAD="$(git rev-parse --verify HEAD)"
TARGET_REF="origin/__rollback_test_invalid_ref__"
TMP_LOG="$(mktemp)"
cleanup() {
  rm -f "$TMP_LOG"
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local expected_one="${2:-200}"
  local expected_two="${3:-}"
  local tries="${4:-45}"
  local delay="${5:-2}"
  local code

  for _ in $(seq 1 "$tries"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
    if [[ "$code" == "$expected_one" || ( -n "$expected_two" && "$code" == "$expected_two" ) ]]; then
      echo "$code"
      return 0
    fi
    sleep "$delay"
  done

  echo "$code"
  return 1
}

echo "==> rollback drill start"
echo "- previous_head: ${PREV_HEAD:0:7}"
echo "- invalid_target_ref: ${TARGET_REF}"
echo "- env_file: ${ENV_FILE}"
echo "- profile: ${PROFILE}"

set +e
./scripts/deploy-with-rollback.sh \
  --target-ref "$TARGET_REF" \
  --env-file "$ENV_FILE" \
  --profile "$PROFILE" | tee "$TMP_LOG"
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "Expected deploy-with-rollback to fail for invalid ref, but it succeeded." >&2
  exit 1
fi

if grep -q "❌ No se pudo restaurar servicios al commit previo" "$TMP_LOG"; then
  echo "Rollback drill failed: rollback service restore reported failure." >&2
  exit 1
fi

if grep -q "❌ Falló la restauración de DB durante rollback" "$TMP_LOG"; then
  echo "Rollback drill failed: DB restore during rollback reported failure." >&2
  exit 1
fi

CURRENT_HEAD="$(git rev-parse --verify HEAD)"
if [[ "$CURRENT_HEAD" != "$PREV_HEAD" ]]; then
  echo "Rollback drill failed: HEAD changed (${PREV_HEAD:0:7} -> ${CURRENT_HEAD:0:7})." >&2
  exit 1
fi

health_code="$(wait_for_http "http://localhost:3001/health" "200" "" 50 2 || true)"
if [[ "$health_code" != "200" ]]; then
  echo "Rollback drill failed: backend health is ${health_code}." >&2
  exit 1
fi

frontend_code="$(wait_for_http "http://localhost:5173/login" "200" "304" 50 2 || true)"
if [[ "$frontend_code" != "200" && "$frontend_code" != "304" ]]; then
  echo "Rollback drill failed: frontend health is ${frontend_code}." >&2
  exit 1
fi

echo "==> rollback drill PASS"
echo "- head_restored: ${CURRENT_HEAD:0:7}"
echo "- backend_health: ${health_code}"
echo "- frontend_health: ${frontend_code}"
