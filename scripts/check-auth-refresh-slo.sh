#!/usr/bin/env bash
set -euo pipefail

DOC="docs/execution-backlog-strict.md"
if [ ! -f "$DOC" ]; then
  echo "Missing $DOC" >&2
  exit 1
fi

required_lines=(
  'auth_refresh_error_rate < 0.5%'
  'p95_auth_refresh < 250ms'
  'refresh_retry_success_rate >= 99.5%'
)

for line in "${required_lines[@]}"; do
  if ! grep -Fq "$line" "$DOC"; then
    echo "SLO contract missing line: $line" >&2
    echo "auth-refresh-slo-check: FAIL" >&2
    exit 1
  fi
done

echo "auth-refresh-slo-check: PASS"
