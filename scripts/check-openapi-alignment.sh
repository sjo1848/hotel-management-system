#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTES_FILE="$ROOT_DIR/backend/src/infrastructure/web/routes/mod.rs"
OPENAPI_FILE="$ROOT_DIR/backend/openapi.yaml"

if [[ ! -f "$ROUTES_FILE" ]]; then
  echo "Routes file not found: $ROUTES_FILE" >&2
  exit 1
fi

if [[ ! -f "$OPENAPI_FILE" ]]; then
  echo "OpenAPI file not found: $OPENAPI_FILE" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

routes_norm="$tmp_dir/routes.norm"
docs_norm="$tmp_dir/docs.norm"
missing_in_docs="$tmp_dir/missing_in_docs.txt"
missing_in_routes="$tmp_dir/missing_in_routes.txt"

grep -oE '"/api/v1[^"]*"' "$ROUTES_FILE" \
  | tr -d '"' \
  | sed -E 's/:([A-Za-z_][A-Za-z0-9_]*)/{\1}/g' \
  | sort -u > "$routes_norm"

awk '
  /^paths:/ { in_paths=1; next }
  /^components:/ { in_paths=0 }
  in_paths && /^  \/api\/v1\// {
    path=$1
    sub(/:$/, "", path)
    print path
  }
' "$OPENAPI_FILE" | sort -u > "$docs_norm"

if ! grep -qE '^  - url: http://localhost:3001$' "$OPENAPI_FILE"; then
  echo "OpenAPI server mismatch: expected 'http://localhost:3001' in $OPENAPI_FILE" >&2
  exit 1
fi

comm -23 "$routes_norm" "$docs_norm" > "$missing_in_docs"
comm -13 "$routes_norm" "$docs_norm" > "$missing_in_routes"

if [[ -s "$missing_in_docs" || -s "$missing_in_routes" ]]; then
  echo "OpenAPI alignment check failed."
  if [[ -s "$missing_in_docs" ]]; then
    echo >&2
    echo "Paths present in router but missing in backend/openapi.yaml:" >&2
    cat "$missing_in_docs" >&2
  fi
  if [[ -s "$missing_in_routes" ]]; then
    echo >&2
    echo "Paths present in backend/openapi.yaml but missing in router:" >&2
    cat "$missing_in_routes" >&2
  fi
  exit 1
fi

echo "OpenAPI alignment check passed."
