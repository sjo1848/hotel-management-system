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
  run_frontend_in_named_container() {
    local container_name="$1"
    local workdir
    echo "==> using docker exec ${container_name} fallback"
    workdir="$(docker inspect -f '{{.Config.WorkingDir}}' "$container_name" 2>/dev/null || true)"
    if [[ -z "$workdir" ]]; then
      workdir="/app"
    fi
    docker start "$container_name" >/dev/null 2>&1 || true
    docker exec "$container_name" sh -lc "cd \"$workdir\" && npm run lint"
    docker exec "$container_name" sh -lc "cd \"$workdir\" && npm run test -- --run"
    docker exec "$container_name" sh -lc "cd \"$workdir\" && npm run build"
    ./scripts/frontend-perf-budget.sh
  }

  echo "==> frontend gates"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose up -d frontend >/dev/null 2>&1; then
      echo "==> using docker compose frontend"
      docker compose exec -T frontend npm run lint
      docker compose exec -T frontend npm run test -- --run
      docker compose exec -T frontend npm run build
      ./scripts/frontend-perf-budget.sh
      return 0
    fi
    if docker ps -a --format "{{.Names}}" | grep -qx "hms-frontend"; then
      run_frontend_in_named_container "hms-frontend"
      return 0
    fi
    echo "==> docker compose frontend unavailable; fallback to host"
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
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose config --services 2>/dev/null | grep -qx backend; then
      echo "docker"
      return 0
    fi
  fi
  echo "host"
}

ensure_backend_runner() {
  local runner="$1"
  if [[ "$runner" == "docker" ]]; then
    docker compose up -d db backend >/dev/null 2>&1 || true
  fi
}

run_perf_smoke_gate() {
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for auth refresh perf gate." >&2
    return 1
  fi

  local compose_started=false

  wait_backend_health() {
    local max_attempts="${1:-45}"
    local code
    local attempt
    for attempt in $(seq 1 "$max_attempts"); do
      code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3001/health || true)"
      if [[ "$code" == "200" ]]; then
        return 0
      fi
      sleep 2
    done
    return 1
  }

  if ! wait_backend_health 3; then
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      docker compose up -d db backend >/dev/null 2>&1 || true
      compose_started=true
      if ! wait_backend_health 45; then
        echo "backend did not become healthy for perf smoke gate." >&2
        return 1
      fi
    else
      echo "backend is not healthy and docker is unavailable for perf smoke gate." >&2
      return 1
    fi
  fi

  ./scripts/perf-baseline.sh \
    --requests "${HMS_PERF_SMOKE_REQUESTS:-4}" \
    --concurrency "${HMS_PERF_SMOKE_CONCURRENCY:-1}" \
    --warmup "${HMS_PERF_SMOKE_WARMUP:-0}" \
    --slo-p95-sec "${HMS_PERF_SMOKE_P95:-1.0}" \
    --slo-error-rate "${HMS_PERF_SMOKE_ERROR_RATE:-0.05}" \
    --report /tmp/hms_perf_gate_local.md

  ./scripts/check-auth-refresh-slo.sh \
    --report /tmp/hms_perf_gate_local.md \
    --max-p95 "${HMS_AUTH_REFRESH_MAX_P95:-0.25}" \
    --max-error-rate "${HMS_AUTH_REFRESH_MAX_ERROR_RATE:-0.005}"

  if [[ "$compose_started" == "true" ]]; then
    docker compose stop backend db >/dev/null 2>&1 || true
  fi
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

echo "==> ops slo contract gate"
./scripts/check-ops-slo-contract.sh

echo "==> release ops runtime slo evidence gate"
./scripts/check-release-ops-slo.sh \
  --events-file "${RELEASE_EVENTS_FILE:-scripts/backups/release-events.jsonl}" \
  --window-days "${RELEASE_OPS_WINDOW_DAYS:-30}" \
  --min-sample-size "${RELEASE_OPS_MIN_SAMPLE_SIZE:-10}" \
  --max-cfr-percent "${RELEASE_OPS_MAX_CFR_PERCENT:-10}" \
  --max-rollback-percent "${RELEASE_OPS_MAX_ROLLBACK_PERCENT:-5}" \
  --max-mttr-minutes "${RELEASE_OPS_MAX_MTTR_MINUTES:-30}" \
  --report /tmp/hms_release_ops_slo_local.md

echo "==> business kpi contract gate"
./scripts/check-business-kpi-contract.sh

echo "==> business kpi runtime evidence gate"
./scripts/check-business-kpi-runtime.sh \
  --runner "${HMS_KPI_RUNNER:-auto}" \
  --window-hq-days "${HMS_KPI_HQ_WINDOW_DAYS:-7}" \
  --window-flags-days "${HMS_KPI_FLAGS_WINDOW_DAYS:-7}" \
  --window-upgrade-days "${HMS_KPI_UPGRADE_WINDOW_DAYS:-30}" \
  --min-hq-activation-rate "${HMS_KPI_HQ_MIN_RATE:-60}" \
  --min-feature-usage-rate "${HMS_KPI_FLAGS_MIN_RATE:-70}" \
  --min-plan-upgrade-rate "${HMS_KPI_UPGRADE_MIN_RATE:-5}" \
  --report /tmp/hms_business_kpi_runtime_local.md

echo "==> rbac drift check (fe/be capability matrix)"
./scripts/check-rbac-drift.sh

if [[ "$FULL" == "true" ]]; then
  QA_RUNNER="$(resolve_qa_runner)"
  ensure_backend_runner "$QA_RUNNER"
  echo "==> backend integration"
  RUNNER="$QA_RUNNER" ./scripts/ci-backend-integration.sh --runner "$QA_RUNNER"
  echo "==> backend security regression"
  RUNNER="$QA_RUNNER" ./scripts/backend-security-regression.sh --runner "$QA_RUNNER"
  echo "==> QA core journeys (runner=${QA_RUNNER})"
  ./scripts/qa-core-journeys.sh --runner "$QA_RUNNER"
  echo "==> observability smoke (runner=${QA_RUNNER})"
  ./scripts/observability-smoke.sh --runner "$QA_RUNNER"
  echo "==> backend coverage thresholds"
  ./scripts/backend-coverage-threshold.sh
  echo "==> auth refresh slo runtime gate (local full)"
  run_perf_smoke_gate
fi

run_frontend_gates

echo "==> frontend session coverage gate"
./scripts/check-frontend-session-coverage.sh

if [[ "$FULL" == "true" || "${HMS_E2E_FLAKY_CHECK:-false}" == "true" ]]; then
  echo "==> frontend e2e flaky rate gate"
  ./scripts/check-e2e-flaky-rate.sh \
    --runner "${HMS_E2E_FLAKY_RUNNER:-pw-container}" \
    --runs "${HMS_E2E_FLAKY_RUNS:-30}" \
    --max-failure-rate "${HMS_E2E_FLAKY_MAX_FAILURE_RATE:-1}" \
    --report /tmp/hms_e2e_flaky_report.md \
    --no-manage-stack
else
  echo "==> frontend e2e flaky rate gate (skipped in fast mode; use --full or HMS_E2E_FLAKY_CHECK=true)"
fi

echo "=============================="
echo " HMS GATE (LOCAL) — PASS"
echo "=============================="
