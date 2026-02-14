#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--full]

Default: fast local gate.
--full: include integration/security/core-journeys in addition to fast checks.
USAGE
}

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

FULL=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

run_frontend_gates() {
  echo "==> frontend gates"
  if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
    if docker compose ps --services 2>/dev/null | grep -qx frontend; then
      echo "==> using docker compose frontend"
      docker compose exec -T frontend npm run lint
      docker compose exec -T frontend npm run test -- --run
      docker compose exec -T frontend npm run build
      return 0
    fi
    echo "==> docker compose running but no frontend service; fallback to host"
  else
    echo "==> docker not available; running frontend on host"
  fi
  (
    cd frontend
    npm ci --include=optional
    npm run lint
    npm run test -- --run
    npm run build
  )
}

echo "=============================="
echo " HMS GATE (LOCAL) — START"
echo "=============================="

echo "==> frontend preflight (rollup fallback)"
./scripts/frontend-runner-preflight.sh

echo "==> backend fast CI (fmt/clippy/unit + openapi_contract)"
./scripts/ci-backend.sh

echo "==> openapi alignment (routes vs openapi + mirror docs)"
./scripts/check-openapi-alignment.sh

echo "==> legacy schema convergence"
./scripts/check-legacy-schema-convergence.sh

if [[ "$FULL" == "true" ]]; then
  echo "==> backend integration"
  ./scripts/ci-backend-integration.sh
  echo "==> backend security regression"
  ./scripts/backend-security-regression.sh
  echo "==> QA core journeys"
  ./scripts/qa-core-journeys.sh --runner host
fi

run_frontend_gates

echo "=============================="
echo " HMS GATE (LOCAL) — PASS"
echo "=============================="
