#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "backend/openapi.yaml" || ! -f "frontend/package.json" ]]; then
  echo "Run from repo root." >&2
  exit 1
fi

GENERATED_FILE="frontend/src/api/generated/openapi.ts"
before_hash=""
if [[ -f "$GENERATED_FILE" ]]; then
  before_hash="$(sha256sum "$GENERATED_FILE" | awk '{print $1}')"
fi

run_codegen() {
  if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
    if docker compose ps --services 2>/dev/null | grep -qx frontend; then
      docker compose exec -T frontend npm run codegen:openapi >/dev/null
      return 0
    fi
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node runtime not available and docker compose frontend is not running." >&2
    exit 1
  fi

  (
    cd frontend
    npm run codegen:openapi >/dev/null
  )
}

run_codegen

if [[ ! -f "$GENERATED_FILE" ]]; then
  echo "OpenAPI frontend codegen failed: generated file not found at $GENERATED_FILE" >&2
  exit 1
fi

after_hash="$(sha256sum "$GENERATED_FILE" | awk '{print $1}')"
if [[ "$before_hash" != "$after_hash" ]]; then
  echo "Frontend OpenAPI generated types were out of date and changed during verification." >&2
  echo "Run codegen and commit: frontend/src/api/generated/openapi.ts" >&2
  exit 1
fi

echo "Frontend OpenAPI codegen check passed."

