#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root."
  exit 1
fi

pushd frontend >/dev/null

echo "==> frontend runner preflight: checking rollup binary"
if ! command -v node >/dev/null 2>&1 || ! node -v >/dev/null 2>&1; then
  echo "node runtime unavailable; skipping preflight in this local environment"
  popd >/dev/null
  exit 0
fi

if node -e "require('rollup')" >/dev/null 2>&1; then
  echo "rollup binary available"
  popd >/dev/null
  exit 0
fi

echo "rollup binary missing, applying platform fallback package"
platform="$(uname -s)"
arch="$(uname -m)"
libc_family="gnu"

if command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; then
  libc_family="musl"
fi

rollup_pkg=""
case "${platform}-${arch}-${libc_family}" in
  Linux-x86_64-gnu) rollup_pkg="@rollup/rollup-linux-x64-gnu" ;;
  Linux-x86_64-musl) rollup_pkg="@rollup/rollup-linux-x64-musl" ;;
  Linux-aarch64-gnu) rollup_pkg="@rollup/rollup-linux-arm64-gnu" ;;
  Linux-aarch64-musl) rollup_pkg="@rollup/rollup-linux-arm64-musl" ;;
  Darwin-arm64-gnu) rollup_pkg="@rollup/rollup-darwin-arm64" ;;
  Darwin-x86_64-gnu) rollup_pkg="@rollup/rollup-darwin-x64" ;;
esac

if [ -z "$rollup_pkg" ]; then
  echo "Unsupported platform for rollup fallback: ${platform}-${arch}-${libc_family}"
  exit 1
fi

npm install --no-save "$rollup_pkg"
node -e "require('rollup')"

echo "rollup fallback installed successfully (${rollup_pkg})"
popd >/dev/null
