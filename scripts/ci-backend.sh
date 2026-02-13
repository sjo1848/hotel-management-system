#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

pushd backend >/dev/null

echo "==> fmt"
cargo fmt --all -- --check

echo "==> clippy"
cargo clippy --all-targets --all-features -- -D warnings

echo "==> test"
DATABASE_URL=${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core} cargo test -- --test-threads=1

popd >/dev/null
