#!/usr/bin/env bash
set -euo pipefail

STRICT_MODE="${DOCS_GOVERNANCE_STRICT:-false}"

is_true() {
  [[ "${1,,}" == "true" ]]
}

if [[ ! -f "backend/openapi.yaml" ]]; then
  echo "OpenAPI changelog gate: skipped (backend/openapi.yaml not found)." >&2
  exit 0
fi

if [[ ! -f "docs/api-changelog.md" ]]; then
  if is_true "$STRICT_MODE"; then
    echo "OpenAPI changelog gate: strict mode enabled and docs/api-changelog.md is required." >&2
    exit 1
  fi
  echo "OpenAPI changelog gate: skipped (docs/api-changelog.md not tracked in this workspace)." >&2
  exit 0
fi

resolve_base_ref() {
  if [[ $# -gt 0 && -n "${1:-}" ]]; then
    echo "$1"
    return 0
  fi

  if git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    echo "HEAD~1"
    return 0
  fi

  echo ""
}

BASE_REF="$(resolve_base_ref "${1:-}")"

if [[ -z "$BASE_REF" ]]; then
  echo "OpenAPI changelog gate: skipped (no base ref available)." >&2
  exit 0
fi

if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo "OpenAPI changelog gate: base ref '$BASE_REF' not found." >&2
  exit 1
fi

openapi_changed_committed=$(git diff --name-only "$BASE_REF"...HEAD -- backend/openapi.yaml | wc -l | tr -d ' ')
openapi_changed_worktree=$(git diff --name-only HEAD -- backend/openapi.yaml | wc -l | tr -d ' ')

if [[ "$openapi_changed_committed" == "0" && "$openapi_changed_worktree" == "0" ]]; then
  echo "OpenAPI changelog gate passed (no OpenAPI diff detected)."
  exit 0
fi

changelog_changed_committed=$(git diff --name-only "$BASE_REF"...HEAD -- docs/api-changelog.md | wc -l | tr -d ' ')
changelog_changed_worktree=$(git diff --name-only HEAD -- docs/api-changelog.md | wc -l | tr -d ' ')

if [[ "$changelog_changed_committed" == "0" && "$changelog_changed_worktree" == "0" ]]; then
  echo "OpenAPI changed since $BASE_REF or in working tree but docs/api-changelog.md was not updated." >&2
  exit 1
fi

echo "OpenAPI changelog gate passed."
