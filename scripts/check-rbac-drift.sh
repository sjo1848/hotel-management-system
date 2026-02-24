#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

# Backward-compatible alias: RBAC drift is now validated by canon generation check.
./scripts/generate-rbac-from-canon.sh --check
echo "RBAC capability drift check: PASS"
