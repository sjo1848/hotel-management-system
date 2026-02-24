#!/usr/bin/env bash
set -euo pipefail

DOC_MAIN="docs/execution-backlog-strict.md"
DOC_CONTRACT="docs/validation/ops-kpi-contract.md"

for file in "$DOC_MAIN" "$DOC_CONTRACT"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required contract file: $file" >&2
    exit 1
  fi
done

required_thresholds=(
  "auth_refresh_error_rate < 0.5%"
  "p95_auth_refresh < 250ms"
  "refresh_retry_success_rate >= 99.5%"
  "change_failure_rate <= 10%"
  "rollback_rate <= 5%"
  "mttr_prod < 30 min"
)

for line in "${required_thresholds[@]}"; do
  if ! grep -Fq "$line" "$DOC_MAIN"; then
    echo "execution-backlog contract missing threshold: $line" >&2
    exit 1
  fi
  if ! grep -Fq "$line" "$DOC_CONTRACT"; then
    echo "ops-kpi contract missing threshold: $line" >&2
    exit 1
  fi
done

extract_section() {
  local marker="$1"
  awk -v marker="$marker" '
    $0 == marker { in_block=1; next }
    in_block && /^### / { exit }
    in_block { print }
  ' "$DOC_CONTRACT"
}

check_metric_block() {
  local marker="$1"
  local block
  block="$(extract_section "$marker")"
  if [[ -z "$block" ]]; then
    echo "Missing metric section in contract: $marker" >&2
    exit 1
  fi
  for token in "- Formula:" "- Source:" "- Window:" "- Threshold:" "- Validation command:" "- Owner:"; do
    if ! grep -Fq -- "$token" <<<"$block"; then
      echo "Metric section missing token '$token': $marker" >&2
      exit 1
    fi
  done
}

check_metric_block "### M1. auth_refresh_error_rate"
check_metric_block "### M2. p95_auth_refresh"
check_metric_block "### M3. refresh_retry_success_rate"
check_metric_block "### M4. change_failure_rate"
check_metric_block "### M5. rollback_rate"
check_metric_block "### M6. mttr_prod"

echo "ops-slo-contract-check: PASS"
