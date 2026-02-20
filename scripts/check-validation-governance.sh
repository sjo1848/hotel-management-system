#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE="${DOCS_GOVERNANCE_STRICT:-true}"

is_true() {
  [[ "${1,,}" == "true" ]]
}

VALIDATION_POLICY="docs/validation/validation-policy.md"
ERROR_CODES="docs/errors/error-codes-v1.md"
ERROR_SOURCE="backend/src/domain/errors.rs"

for file in "$VALIDATION_POLICY" "$ERROR_CODES" "$ERROR_SOURCE"; do
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

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

extract_contract_codes() {
  awk '
    /pub const CONTRACT_ERROR_CODES_V1/ { in_block=1 }
    in_block {
      line=$0
      while (match(line, /"[^"]+"/)) {
        value=substr(line, RSTART + 1, RLENGTH - 2)
        print value
        line=substr(line, RSTART + RLENGTH)
      }
      if (index($0, "];")) { in_block=0 }
    }
  ' "$ERROR_SOURCE" | LC_ALL=C sort -u
}

extract_doc_codes() {
  grep -oE '`[A-Z0-9_]+`' "$ERROR_CODES" | tr -d '`' | LC_ALL=C sort -u
}

extract_contract_codes > "${tmpdir}/contract_codes.txt"
extract_doc_codes > "${tmpdir}/doc_codes.txt"

missing_in_doc="${tmpdir}/missing_in_doc.txt"
extra_in_doc="${tmpdir}/extra_in_doc.txt"
comm -23 "${tmpdir}/contract_codes.txt" "${tmpdir}/doc_codes.txt" > "$missing_in_doc" || true
comm -13 "${tmpdir}/contract_codes.txt" "${tmpdir}/doc_codes.txt" > "$extra_in_doc" || true

if [[ -s "$missing_in_doc" || -s "$extra_in_doc" ]]; then
  echo "Validation governance mismatch between runtime contract and docs catalog." >&2
  if [[ -s "$missing_in_doc" ]]; then
    echo "Missing in docs/errors/error-codes-v1.md:" >&2
    sed 's/^/  - /' "$missing_in_doc" >&2
  fi
  if [[ -s "$extra_in_doc" ]]; then
    echo "Documented but not present in runtime contract:" >&2
    sed 's/^/  - /' "$extra_in_doc" >&2
  fi
  exit 1
fi

echo "Validation governance check passed."
