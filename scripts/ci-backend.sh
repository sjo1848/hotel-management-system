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
cargo test --lib -- --test-threads=1
cargo test --test openapi_contract

popd >/dev/null
