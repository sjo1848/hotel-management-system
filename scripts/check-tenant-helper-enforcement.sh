#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

ALLOWLIST_FILE="docs/validation/tenant-helper-enforcement-allowlist.txt"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "Missing allowlist file: $ALLOWLIST_FILE" >&2
  exit 1
fi

declare -A ALLOWLIST
while IFS= read -r raw; do
  line="${raw%%#*}"
  line="${line%%|*}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -z "$line" ] && continue
  ALLOWLIST["$line"]=1
done < "$ALLOWLIST_FILE"

tenant_table_re='users|rooms|bookings|guests|invoices|refresh_tokens|audit_events|extra_charges|cash_closures'
sql_ops_re='sqlx::query|sqlx::query_as|sqlx::query_scalar|\.fetch_|\.execute\('
helper_re='begin_tenant_tx|begin_refresh_token_lookup_tx'

violations=()
scanned=0
allowlisted_hits=0

while IFS= read -r file; do
  scanned=$((scanned + 1))

  if [ -n "${ALLOWLIST[$file]+x}" ]; then
    allowlisted_hits=$((allowlisted_hits + 1))
    continue
  fi

  if ! grep -Eiq "$tenant_table_re" "$file"; then
    continue
  fi

  if ! grep -Eq "$sql_ops_re" "$file"; then
    continue
  fi

  if ! grep -Eq "$helper_re" "$file"; then
    violations+=("$file")
  fi
done < <(find backend/src/infrastructure/repository -maxdepth 1 -type f -name 'postgres*.rs' | LC_ALL=C sort)

if [ "${#violations[@]}" -gt 0 ]; then
  echo "tenant-helper-enforcement: FAIL" >&2
  echo "Violations (${#violations[@]}):" >&2
  for file in "${violations[@]}"; do
    echo "  - $file" >&2
  done
  exit 1
fi

echo "tenant-helper-enforcement: PASS (scanned=${scanned}, allowlisted=${allowlisted_hits})"
