#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE="${DOCS_GOVERNANCE_STRICT:-false}"

is_true() {
  [[ "${1,,}" == "true" ]]
}

VALIDATION_POLICY="docs/validation/validation-policy.md"
ERROR_CODES="docs/errors/error-codes-v1.md"

for file in "$VALIDATION_POLICY" "$ERROR_CODES"; do
  if [[ ! -f "$file" ]]; then
    if is_true "$STRICT_MODE"; then
      echo "Validation governance gate: strict mode enabled and required file is missing: $file" >&2
      exit 1
    fi
    echo "Validation governance gate: skipped ($file not tracked in this workspace)." >&2
    exit 0
  fi
done

if ! grep -q "Capas de validación" "$VALIDATION_POLICY"; then
  echo "Validation policy missing 'Capas de validación' section." >&2
  exit 1
fi

if ! grep -q "Checklist por endpoint nuevo" "$VALIDATION_POLICY"; then
  echo "Validation policy missing endpoint checklist." >&2
  exit 1
fi

required_error_codes=(
  "UNAUTHORIZED"
  "FORBIDDEN"
  "INVALID_INPUT"
  "INFRA_ERROR"
  "ROOM_NOT_FOUND"
  "BOOKING_NOT_FOUND"
)

for code in "${required_error_codes[@]}"; do
  if ! grep -q "$code" "$ERROR_CODES"; then
    echo "Error catalog missing required code: $code" >&2
    exit 1
  fi
done

echo "Validation governance check passed."
