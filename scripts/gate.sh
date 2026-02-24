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
      ./scripts/frontend-perf-budget.sh
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
    ../scripts/frontend-perf-budget.sh
  )
}

resolve_qa_runner() {
  if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
    if docker compose ps --services 2>/dev/null | grep -qx backend; then
      echo "docker"
      return 0
    fi
  fi
  echo "host"
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

echo "==> openapi frontend client drift"
./scripts/check-openapi-client-drift.sh

echo "==> environment profile security preflight"
./scripts/check-env-profile-security.sh

echo "==> openapi changelog contractual gate"
./scripts/check-openapi-changelog.sh

echo "==> legacy schema convergence"
./scripts/check-legacy-schema-convergence.sh

echo "==> validation governance docs gate"
./scripts/check-validation-governance.sh

echo "==> tenant helper enforcement gate"
./scripts/check-tenant-helper-enforcement.sh

echo "==> rbac canon gate"
./scripts/check-rbac-canon.sh

echo "==> auth refresh slo contract gate"
./scripts/check-auth-refresh-slo.sh

echo "==> rbac drift check (fe/be capability matrix)"
./scripts/check-rbac-drift.sh

if [[ "$FULL" == "true" ]]; then
  echo "==> backend integration"
  ./scripts/ci-backend-integration.sh
  echo "==> backend security regression"
  ./scripts/backend-security-regression.sh
  QA_RUNNER="$(resolve_qa_runner)"
  echo "==> QA core journeys (runner=${QA_RUNNER})"
  ./scripts/qa-core-journeys.sh --runner "$QA_RUNNER"
  echo "==> observability smoke (runner=${QA_RUNNER})"
  ./scripts/observability-smoke.sh --runner "$QA_RUNNER"
  echo "==> backend coverage thresholds"
  ./scripts/backend-coverage-threshold.sh
fi

run_frontend_gates

echo "==> frontend session coverage gate"
./scripts/check-frontend-session-coverage.sh

if [[ "${HMS_E2E_FLAKY_CHECK:-false}" == "true" ]]; then
  echo "==> frontend e2e flaky rate gate"
  ./scripts/check-e2e-flaky-rate.sh \
    --runner "${HMS_E2E_FLAKY_RUNNER:-pw-container}" \
    --runs "${HMS_E2E_FLAKY_RUNS:-30}" \
    --max-failure-rate "${HMS_E2E_FLAKY_MAX_FAILURE_RATE:-1}" \
    --report /tmp/hms_e2e_flaky_report.md
else
  echo "==> frontend e2e flaky rate gate (skipped; set HMS_E2E_FLAKY_CHECK=true)"
fi

echo "=============================="
echo " HMS GATE (LOCAL) — PASS"
echo "=============================="
