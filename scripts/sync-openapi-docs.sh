#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$ROOT_DIR/backend/openapi.yaml" "$ROOT_DIR/docs/openapi.yaml"
echo "Synced docs/openapi.yaml from backend/openapi.yaml"
