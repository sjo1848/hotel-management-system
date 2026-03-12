#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d ".git" && ! -f ".git" ]]; then
  echo "Run from repo root." >&2
  exit 1
fi

LOCK_FILE="${HMS_BASELINE_LOCK_FILE:-scripts/baseline-origin-main.lock}"
FETCH_REMOTE="${HMS_BASELINE_FETCH_REMOTE:-true}"

if [[ ! -f "$LOCK_FILE" ]]; then
  echo "baseline lock file not found: $LOCK_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$LOCK_FILE"

if [[ -z "${BASELINE_REF:-}" || -z "${BASELINE_SHA:-}" || -z "${BASELINE_COMMIT_DATE:-}" ]]; then
  echo "baseline lock file is missing BASELINE_REF/BASELINE_SHA/BASELINE_COMMIT_DATE." >&2
  exit 1
fi

if [[ "$FETCH_REMOTE" == "true" ]]; then
  git fetch origin --prune >/dev/null
fi

if ! git rev-parse --verify --quiet "$BASELINE_REF" >/dev/null; then
  echo "baseline ref not found locally: $BASELINE_REF" >&2
  exit 1
fi

actual_sha="$(git rev-parse "$BASELINE_REF")"
actual_date="$(git show -s --format='%ci' "$BASELINE_REF")"

echo "==> baseline fingerprint gate"
echo "lock_file: $LOCK_FILE"
echo "ref: $BASELINE_REF"
echo "expected_sha: $BASELINE_SHA"
echo "actual_sha:   $actual_sha"
echo "expected_date: $BASELINE_COMMIT_DATE"
echo "actual_date:   $actual_date"

if [[ "$actual_sha" != "$BASELINE_SHA" || "$actual_date" != "$BASELINE_COMMIT_DATE" ]]; then
  echo "baseline-fingerprint: FAIL (origin/main fingerprint drift detected)" >&2
  exit 1
fi

echo "baseline-fingerprint: PASS (ref fingerprint matches lock)"
