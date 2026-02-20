#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend/src"
OPENAPI_FILE="$ROOT_DIR/backend/openapi.yaml"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend source directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

if [[ ! -f "$OPENAPI_FILE" ]]; then
  echo "OpenAPI file not found: $OPENAPI_FILE" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

frontend_raw="$tmp_dir/frontend.raw"
frontend_norm="$tmp_dir/frontend.norm"
openapi_norm="$tmp_dir/openapi.norm"
missing_in_openapi="$tmp_dir/missing_in_openapi.txt"

find "$FRONTEND_DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' \
  ! -name '*.test.tsx' \
  ! -name 'setupTests.ts' \
  -print0 \
  | xargs -0 perl -0777 -ne '
      while (/apiGet(?:<[^>]*>)?\s*\(\s*([`"])([^`"]+)\1/sg) {
        print "GET $2\n";
      }
      while (/apiPost(?:<[^>]*>)?\s*\(\s*([`"])([^`"]+)\1/sg) {
        print "POST $2\n";
      }
      while (/apiPatch(?:<[^>]*>)?\s*\(\s*([`"])([^`"]+)\1/sg) {
        print "PATCH $2\n";
      }
      while (/apiDelete(?:<[^>]*>)?\s*\(\s*([`"])([^`"]+)\1/sg) {
        print "DELETE $2\n";
      }
      while (/client\.(get|post|patch|put|delete)\s*\(\s*([`"])([^`"]+)\2/sgi) {
        print uc($1) . " $3\n";
      }
      while (/fetch\s*\(\s*([`"])([^`"]+)\1\s*,\s*\{(.*?)\}\s*\)/sgi) {
        my $method = "GET";
        my $options = $3;
        if ($options =~ /method\s*:\s*["'\'']([A-Za-z]+)["'\'']/i) {
          $method = uc($1);
        }
        print "$method $2\n";
      }
    ' > "$frontend_raw"

awk '
  {
    method = toupper($1);
    path = $2;
    if (path == "") {
      next;
    }
    if (path !~ /^\/api\/v1\//) {
      path = "/api/v1" path;
    }
    gsub(/\$\{[^}]+\}/, "{id}", path);
    gsub(/:[A-Za-z_][A-Za-z0-9_]*/, "{id}", path);
    sub(/\?.*$/, "", path);
    gsub(/\/+/, "/", path);
    if (length(path) > 1) {
      sub(/\/$/, "", path);
    }
    print method " " path;
  }
' "$frontend_raw" | sort -u > "$frontend_norm"

awk '
  /^paths:/ { in_paths = 1; next }
  /^components:/ { in_paths = 0 }
  in_paths && /^  \/api\/v1\// {
    path = $1
    sub(/:$/, "", path)
    next
  }
  in_paths && /^    (get|post|patch|put|delete):/ {
    method = toupper($1)
    sub(/:$/, "", method)
    print method " " path
  }
' "$OPENAPI_FILE" | sort -u > "$openapi_norm"

comm -23 "$frontend_norm" "$openapi_norm" > "$missing_in_openapi"

if [[ -s "$missing_in_openapi" ]]; then
  echo "Frontend/OpenAPI drift check failed." >&2
  echo >&2
  echo "Frontend calls missing in backend/openapi.yaml:" >&2
  cat "$missing_in_openapi" >&2
  exit 1
fi

echo "Frontend/OpenAPI drift check passed."
