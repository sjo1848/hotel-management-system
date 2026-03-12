#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "frontend/package.json" ]]; then
  echo "Run from repo root." >&2
  exit 1
fi

MIN_TESTS="${HMS_FE_CRITICAL_MIN_TESTS:-12}"
if ! [[ "$MIN_TESTS" =~ ^[0-9]+$ ]] || [[ "$MIN_TESTS" -le 0 ]]; then
  echo "HMS_FE_CRITICAL_MIN_TESTS must be a positive integer." >&2
  exit 1
fi

CRITICAL_FILES=(
  "frontend/src/features/auth/AuthContext.test.tsx"
  "frontend/src/App.guards.test.tsx"
  "frontend/src/api/client.interceptor.test.ts"
)

PATTERN='^[[:space:]]*(it|test)(\.(only|skip|concurrent|todo|fails|each))?[[:space:]]*\('
total=0

echo "==> frontend critical suite minimum (threshold=${MIN_TESTS})"
for file in "${CRITICAL_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing required critical test file: $file" >&2
    exit 1
  fi
  count="$(grep -E "$PATTERN" "$file" | wc -l | tr -d ' ')"
  total=$((total + count))
  printf "%-58s %3d\n" "$file" "$count"
done

echo "total_critical_tests=${total}"

if [[ "$total" -lt "$MIN_TESTS" ]]; then
  echo "frontend-critical-suite: FAIL (total=${total} < threshold=${MIN_TESTS})" >&2
  exit 1
fi

echo "frontend-critical-suite: PASS (total=${total} >= threshold=${MIN_TESTS})"
