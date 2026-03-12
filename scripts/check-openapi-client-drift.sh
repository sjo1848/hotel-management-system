#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_FILE="$ROOT_DIR/frontend/src/api/generated/openapi.ts"
GENERATOR_SCRIPT="$ROOT_DIR/scripts/generate-openapi-client.sh"

if [[ ! -x "$GENERATOR_SCRIPT" ]]; then
  echo "OpenAPI client drift check: missing executable $GENERATOR_SCRIPT" >&2
  exit 1
fi

if [[ ! -f "$TARGET_FILE" ]]; then
  echo "OpenAPI client drift check: missing generated client at $TARGET_FILE" >&2
  echo "Run: ./scripts/generate-openapi-client.sh" >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

MAX_ATTEMPTS="${HMS_OPENAPI_CLIENT_DRIFT_RETRIES:-3}"
RETRY_DELAY_SEC="${HMS_OPENAPI_CLIENT_DRIFT_RETRY_DELAY_SEC:-2}"

attempt=1
while true; do
  if "$GENERATOR_SCRIPT" "$tmp_file"; then
    break
  fi

  if [[ "$attempt" -ge "$MAX_ATTEMPTS" ]]; then
    echo "OpenAPI client drift check: generation failed after ${MAX_ATTEMPTS} attempts." >&2
    exit 1
  fi

  echo "OpenAPI client drift check: generation failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${RETRY_DELAY_SEC}s..." >&2
  attempt=$((attempt + 1))
  sleep "$RETRY_DELAY_SEC"
done

if ! cmp -s "$tmp_file" "$TARGET_FILE"; then
  echo "OpenAPI frontend client drift detected: $TARGET_FILE is out of sync." >&2
  echo "Run: ./scripts/generate-openapi-client.sh" >&2
  diff -u "$TARGET_FILE" "$tmp_file" || true
  exit 1
fi

echo "OpenAPI frontend client drift check passed."
