#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }
}

require_file() {
  [[ -f "$1" ]] || { echo "Missing file: $1" >&2; exit 1; }
}

require_cmd docker
require_file scripts/validate-env-profile.sh
require_file .env.example
require_file .env.staging.example
require_file .env.prod.example
require_file docker-compose.yml
require_file docker-compose.staging.yml
require_file docker-compose.prod.yml

echo "==> validate dev profile (.env.example)"
./scripts/validate-env-profile.sh \
  --profile dev \
  --env-file .env.example \
  --allow-placeholder-values

echo "==> validate staging profile (.env.staging.example)"
./scripts/validate-env-profile.sh \
  --profile staging \
  --env-file .env.staging.example \
  --allow-placeholder-values

echo "==> validate prod profile (.env.prod.example)"
./scripts/validate-env-profile.sh \
  --profile prod \
  --env-file .env.prod.example \
  --allow-placeholder-values

echo "==> resolve compose for dev/staging/prod"
docker compose --env-file .env.example -f docker-compose.yml config >/tmp/hms-compose-dev.resolved.yml
docker compose --env-file .env.staging.example -f docker-compose.yml -f docker-compose.staging.yml config >/tmp/hms-compose-staging.resolved.yml
docker compose --env-file .env.prod.example -f docker-compose.yml -f docker-compose.prod.yml config >/tmp/hms-compose-prod.resolved.yml

echo "Environment profile security preflight passed."
