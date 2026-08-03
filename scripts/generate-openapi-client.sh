#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENAPI_FILE="$ROOT_DIR/backend/openapi.yaml"
OUTPUT_FILE="${1:-$ROOT_DIR/frontend/src/api/generated/openapi.ts}"

if [[ ! -f "$OPENAPI_FILE" ]]; then
  echo "OpenAPI source not found: $OPENAPI_FILE" >&2
  exit 1
fi

generate_to_stdout() {
  if command -v node >/dev/null 2>&1 && command -v npx >/dev/null 2>&1 && node --version >/dev/null 2>&1 && npx --version >/dev/null 2>&1; then
    (
      cd "$ROOT_DIR"
      npx --yes --quiet openapi-typescript backend/openapi.yaml
    )
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker compose ps frontend >/dev/null 2>&1; then
    docker compose cp "$OPENAPI_FILE" frontend:/tmp/hms-openapi.yaml >/dev/null 2>&1
    docker compose exec -T frontend sh -lc '
      if [ -x /app/node_modules/.bin/openapi-typescript ]; then
        /app/node_modules/.bin/openapi-typescript /tmp/hms-openapi.yaml
      else
        npx --yes --quiet openapi-typescript /tmp/hms-openapi.yaml
      fi
    '
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    docker run --rm \
      -v "$ROOT_DIR":/workspace \
      -w /workspace \
      node:20-alpine \
      sh -lc "npx --yes --quiet openapi-typescript backend/openapi.yaml"
    return 0
  fi

  echo "No generator runtime available. Install node+npx or docker." >&2
  return 1
}

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

generate_to_stdout >"$tmp_file"

mkdir -p "$(dirname "$OUTPUT_FILE")"
mv "$tmp_file" "$OUTPUT_FILE"
