#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

CANON_FILE="docs/validation/rbac-canon-v1.txt"
BACKEND_FILE="backend/src/infrastructure/web/middleware/rbac.rs"
FRONTEND_FILE="frontend/src/features/auth/capabilities.ts"

for file in "$CANON_FILE" "$BACKEND_FILE" "$FRONTEND_FILE"; do
  if [ ! -f "$file" ]; then
    echo "RBAC canon check missing required file: $file" >&2
    exit 1
  fi
done

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

extract_const_strings() {
  local file="$1"
  local const_name="$2"
  awk -v target="$const_name" '
    index($0, "const " target) { in_block=1 }
    in_block {
      line=$0
      while (match(line, /"[^"]+"/)) {
        value=substr(line, RSTART + 1, RLENGTH - 2)
        print value
        line=substr(line, RSTART + RLENGTH)
      }
      if (index($0, "];")) { in_block=0 }
    }
  ' "$file" | LC_ALL=C sort -u
}

extract_ts_union_strings() {
  local file="$1"
  awk '
    /export type Capability =/ { in_union=1; next }
    in_union {
      line=$0
      while (match(line, /"[^"]+"/)) {
        value=substr(line, RSTART + 1, RLENGTH - 2)
        print value
        line=substr(line, RSTART + RLENGTH)
      }
      if (index($0, ";")) { in_union=0 }
    }
  ' "$file" | LC_ALL=C sort -u
}

sanitize_canon() {
  local file="$1"
  awk '
    {
      gsub(/\r/, "", $0)
      line=$0
      sub(/#.*/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (line != "") print line
    }
  ' "$file" | LC_ALL=C sort -u
}

print_set() {
  local file="$1"
  if [ -s "$file" ]; then
    sed 's/^/  - /' "$file"
  else
    echo "  - (none)"
  fi
}

compare_sets() {
  local label="$1"
  local expected_file="$2"
  local actual_file="$3"
  local missing_file="${tmpdir}/${label}.missing"
  local extra_file="${tmpdir}/${label}.extra"

  comm -23 "$expected_file" "$actual_file" > "$missing_file" || true
  comm -13 "$expected_file" "$actual_file" > "$extra_file" || true

  if [ -s "$missing_file" ] || [ -s "$extra_file" ]; then
    echo "RBAC canon mismatch: ${label}" >&2
    if [ -s "$missing_file" ]; then
      echo "Missing in actual:" >&2
      print_set "$missing_file" >&2
    fi
    if [ -s "$extra_file" ]; then
      echo "Extra in actual:" >&2
      print_set "$extra_file" >&2
    fi
    return 1
  fi

  return 0
}

roles=(
  "ADMIN_CAPABILITIES"
  "SAAS_ADMIN_CAPABILITIES"
  "OPS_CAPABILITIES"
  "RECEPTIONIST_CAPABILITIES"
  "HOUSEKEEPING_CAPABILITIES"
)

for role_const in "${roles[@]}"; do
  extract_const_strings "$BACKEND_FILE" "$role_const" > "${tmpdir}/backend_${role_const}.txt"
done

cat \
  "${tmpdir}/backend_ADMIN_CAPABILITIES.txt" \
  "${tmpdir}/backend_SAAS_ADMIN_CAPABILITIES.txt" \
  "${tmpdir}/backend_OPS_CAPABILITIES.txt" \
  "${tmpdir}/backend_RECEPTIONIST_CAPABILITIES.txt" \
  "${tmpdir}/backend_HOUSEKEEPING_CAPABILITIES.txt" | LC_ALL=C sort -u > "${tmpdir}/backend_union.txt"

extract_ts_union_strings "$FRONTEND_FILE" > "${tmpdir}/frontend_union.txt"
sanitize_canon "$CANON_FILE" > "${tmpdir}/canon.txt"

failures=0
if ! compare_sets "Backend capabilities vs canon" "${tmpdir}/canon.txt" "${tmpdir}/backend_union.txt"; then
  failures=1
fi
if ! compare_sets "Frontend capability union vs canon" "${tmpdir}/canon.txt" "${tmpdir}/frontend_union.txt"; then
  failures=1
fi

if [ "$failures" -ne 0 ]; then
  echo "RBAC canon check: FAIL" >&2
  exit 1
fi

echo "RBAC canon check: PASS"
