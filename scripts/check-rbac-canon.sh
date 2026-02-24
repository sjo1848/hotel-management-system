#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

./scripts/generate-rbac-from-canon.sh --check
echo "RBAC canon check: PASS"
