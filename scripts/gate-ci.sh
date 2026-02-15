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

run_perf_smoke_gate() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required for perf smoke gate." >&2
    return 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for perf smoke gate." >&2
    return 1
  fi

  local compose_started=false
  local local_backend_started=false
  local local_perf_db_container=""
  local local_perf_db_port="55432"
  local local_perf_pid_file="/tmp/hms_perf_gate_backend.pid"
  local local_perf_log_file="/tmp/hms_perf_gate_backend.log"

  cleanup_perf_smoke_gate() {
    if [[ "$local_backend_started" == "true" ]]; then
      if [[ -f "$local_perf_pid_file" ]]; then
        local pid
        pid="$(cat "$local_perf_pid_file" 2>/dev/null || true)"
        if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
          kill "$pid" >/dev/null 2>&1 || true
        fi
      fi
      rm -f "$local_perf_pid_file" >/dev/null 2>&1 || true
      if [[ -n "$local_perf_db_container" ]]; then
        docker rm -f "$local_perf_db_container" >/dev/null 2>&1 || true
      fi
    fi
    if [[ "$compose_started" == "true" ]]; then
      docker compose stop backend db >/dev/null 2>&1 || true
    fi
  }
  trap cleanup_perf_smoke_gate RETURN

  wait_backend_health() {
    local max_attempts="${1:-60}"
    local attempt
    local code
    for attempt in $(seq 1 "$max_attempts"); do
      code="$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3001/health || true)"
      if [[ "$code" == "200" ]]; then
        return 0
      fi
      sleep 2
    done
    return 1
  }

  echo "==> perf smoke gate"
  if wait_backend_health 3; then
    echo "==> reusing existing healthy backend on localhost:3001"
  else
    echo "==> backend not healthy; starting docker compose stack for perf smoke"
    docker compose up -d db backend
    compose_started=true
    if ! wait_backend_health 30; then
      echo "==> compose backend did not become healthy; switching to isolated local perf backend"
      docker compose stop backend db >/dev/null 2>&1 || true
      compose_started=false

      local_perf_db_container="hms-perf-gate-db-$$"
      docker rm -f "$local_perf_db_container" >/dev/null 2>&1 || true
      docker run -d \
        --name "$local_perf_db_container" \
        -e POSTGRES_USER=admin \
        -e POSTGRES_PASSWORD=password123 \
        -e POSTGRES_DB=hms_core \
        -p "${local_perf_db_port}:5432" \
        postgres:16-alpine >/dev/null

      local pg_ready=false
      local attempt
      for attempt in $(seq 1 30); do
        if docker exec "$local_perf_db_container" pg_isready -U admin -d hms_core >/dev/null 2>&1; then
          pg_ready=true
          break
        fi
        sleep 2
      done
      if [[ "$pg_ready" != "true" ]]; then
        echo "isolated perf postgres did not become ready." >&2
        return 1
      fi

      (
        cd backend
        DATABASE_URL="postgres://admin:password123@localhost:${local_perf_db_port}/hms_core" \
          cargo run >"$local_perf_log_file" 2>&1 &
        echo $! >"$local_perf_pid_file"
      )
      local_backend_started=true

      if ! wait_backend_health 60; then
        echo "isolated perf backend did not become healthy at http://localhost:3001/health" >&2
        if [[ -f "$local_perf_log_file" ]]; then
          tail -n 80 "$local_perf_log_file" >&2 || true
        fi
        return 1
      fi
    fi
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

echo "==> environment profile security preflight"
./scripts/check-env-profile-security.sh

echo "==> openapi changelog contractual gate"
./scripts/check-openapi-changelog.sh

echo "==> legacy schema convergence"
./scripts/check-legacy-schema-convergence.sh

echo "==> validation governance docs gate"
./scripts/check-validation-governance.sh

echo "==> rbac drift check (fe/be capability matrix)"
./scripts/check-rbac-drift.sh

echo "==> backend integration (requires DATABASE_URL / postgres ready)"
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

if [[ "$SKIP_FRONTEND" != "true" ]]; then
  echo "==> frontend preflight (rollup fallback)"
  ./scripts/frontend-runner-preflight.sh
  run_frontend_gates
fi

if [[ "$SKIP_PERF" != "true" ]]; then
  run_perf_smoke_gate
fi

echo "=============================="
echo " HMS GATE (CI) — PASS"
echo "=============================="
