#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--env-file .env.prod]

Runs preflight checks before a real production deploy.
USAGE
}

ENV_FILE=".env.prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] missing command: $1" >&2; exit 1; }
}

require_file() {
  [[ -f "$1" ]] || { echo "[FAIL] missing file: $1" >&2; exit 1; }
}

require_cmd docker
require_cmd git
require_file docker-compose.yml
require_file docker-compose.prod.yml
require_file scripts/validate-prod-env.sh
require_file scripts/deploy-with-rollback.sh
require_file "$ENV_FILE"

./scripts/validate-prod-env.sh --env-file "$ENV_FILE"

docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/hms-prod-compose.resolved.yml

echo "[OK] prod deploy readiness checks passed"
echo "[OK] resolved compose written: /tmp/hms-prod-compose.resolved.yml"

echo "Next command:"
echo "  ./scripts/deploy-with-rollback.sh --env-file $ENV_FILE --profile prod"
