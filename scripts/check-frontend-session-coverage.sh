#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "frontend/package.json" ]; then
  echo "Run from repo root." >&2
  exit 1
fi

THRESHOLD="${HMS_FE_SESSION_COVERAGE_MIN:-80}"
REPORT_REL="coverage/coverage-summary.json"
REPORT_HOST="frontend/${REPORT_REL}"

run_coverage_docker() {
  docker compose exec -T frontend npm run coverage -- \
    --coverage.reporter=json-summary \
    --coverage.reportsDirectory=coverage
}

run_coverage_host() {
  (
    cd frontend
    npm run coverage -- \
      --coverage.reporter=json-summary \
      --coverage.reportsDirectory=coverage
  )
}

if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
  if docker compose ps --services 2>/dev/null | grep -qx frontend; then
    echo "==> frontend coverage runner: docker"
    run_coverage_docker
  else
    echo "==> frontend coverage runner: host (frontend service not found)"
    run_coverage_host
  fi
else
  echo "==> frontend coverage runner: host (docker unavailable)"
  run_coverage_host
fi

if [ ! -f "$REPORT_HOST" ]; then
  echo "Coverage summary not found: $REPORT_HOST" >&2
  exit 1
fi

python3 - "$REPORT_HOST" "$THRESHOLD" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
threshold = float(sys.argv[2])

targets = {
    "auth_context": "src/features/auth/AuthContext.tsx",
    "app_routing": "src/App.tsx",
    "api_interceptor": "src/api/client.ts",
}

with report_path.open("r", encoding="utf-8") as f:
    data = json.load(f)

missing: list[str] = []
below: list[tuple[str, float]] = []

for label, suffix in targets.items():
    match_key = next((k for k in data.keys() if k.endswith(suffix)), None)
    if not match_key:
        missing.append(suffix)
        continue
    pct = float(data[match_key]["lines"]["pct"])
    print(f"{suffix}: {pct:.2f}%")
    if pct < threshold:
        below.append((suffix, pct))

if missing:
    print("Missing coverage entries:", file=sys.stderr)
    for m in missing:
        print(f"  - {m}", file=sys.stderr)
    raise SystemExit(1)

if below:
    print(f"Coverage below threshold {threshold:.2f}%:", file=sys.stderr)
    for suffix, pct in below:
        print(f"  - {suffix}: {pct:.2f}%", file=sys.stderr)
    raise SystemExit(1)

print(f"Frontend session coverage gate: PASS (threshold={threshold:.2f}%)")
PY
