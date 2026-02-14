#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/openapi.yaml" ]; then
  echo "OpenAPI changelog gate: skipped (backend/openapi.yaml not found)." >&2
  exit 0
fi

if [ ! -f "docs/api-changelog.md" ]; then
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

openapi_changed=$(
  git diff --name-only "$BASE_REF"...HEAD -- backend/openapi.yaml docs/openapi.yaml | wc -l | tr -d ' '
)

if [[ "$openapi_changed" == "0" ]]; then
  echo "OpenAPI changelog gate passed (no OpenAPI diff detected)."
  exit 0
fi

changelog_changed=$(
  git diff --name-only "$BASE_REF"...HEAD -- docs/api-changelog.md | wc -l | tr -d ' '
)

if [[ "$changelog_changed" == "0" ]]; then
  echo "OpenAPI changed since $BASE_REF but docs/api-changelog.md was not updated." >&2
  exit 1
fi

echo "OpenAPI changelog gate passed."
