#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--skip-frontend] [--skip-perf]

Runs a high-parity CI gate sequence from repo root.
USAGE
}

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

SKIP_FRONTEND=false
SKIP_PERF=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-frontend) SKIP_FRONTEND=true; shift ;;
    --skip-perf) SKIP_PERF=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

run_frontend_gates() {
  echo "==> frontend gates"
  if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
    if docker compose ps --services 2>/dev/null | grep -qx frontend; then
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

run_perf_smoke_gate() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required for perf smoke gate." >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for perf smoke gate." >&2
    return 1
  fi

  echo "==> perf smoke gate"
  docker compose up -d db backend
  trap 'docker compose stop backend db >/dev/null 2>&1 || true' RETURN

  ready=false
  for _ in $(seq 1 60); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3001/health || true)"
    if [[ "$code" == "200" ]]; then
      ready=true
      break
    fi
    sleep 2
  done
  if [[ "$ready" != "true" ]]; then
    echo "backend did not become healthy at http://localhost:3001/health" >&2
    return 1
  fi

  ./scripts/perf-baseline.sh \
    --requests 8 \
    --concurrency 2 \
    --warmup 1 \
    --slo-p95-sec 1.0 \
    --slo-error-rate 0.05 \
    --fail-on-slo \
    --report /tmp/hms_perf_gate_ci.md
  cat /tmp/hms_perf_gate_ci.md
}

echo "=============================="
echo " HMS GATE (CI) — START"
echo "=============================="

echo "==> backend fast CI"
./scripts/ci-backend.sh

echo "==> openapi alignment"
./scripts/check-openapi-alignment.sh

echo "==> legacy schema convergence"
./scripts/check-legacy-schema-convergence.sh

echo "==> backend integration (requires DATABASE_URL / postgres ready)"
./scripts/ci-backend-integration.sh

echo "==> backend security regression"
./scripts/backend-security-regression.sh

echo "==> QA core journeys (host runner)"
./scripts/qa-core-journeys.sh --runner host

if [[ "$SKIP_FRONTEND" != "true" ]]; then
  run_frontend_gates
fi

if [[ "$SKIP_PERF" != "true" ]]; then
  run_perf_smoke_gate
fi

echo "=============================="
echo " HMS GATE (CI) — PASS"
echo "=============================="
