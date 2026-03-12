#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --runner auto|host|docker          DB query runner (default: auto)
  --database-url URL                 Postgres URL for host runner
  --window-hq-days N                 Window for HQ activation (default: 7)
  --window-flags-days N              Window for feature flags usage (default: 7)
  --window-upgrade-days N            Window for plan upgrades (default: 30)
  --min-hq-activation-rate N         Threshold percent (default: 60)
  --min-feature-usage-rate N         Threshold percent (default: 70)
  --min-plan-upgrade-rate N          Threshold percent (default: 5)
  --fail-on-threshold                Exit non-zero when threshold breaches with valid denominator
  --report FILE                      Markdown report path (default: /tmp/hms_business_kpi_runtime.md)
USAGE
}

RUNNER="${RUNNER:-auto}"
DATABASE_URL="${DATABASE_URL:-postgres://admin:password123@localhost:5432/hms_core}"
WINDOW_HQ_DAYS=7
WINDOW_FLAGS_DAYS=7
WINDOW_UPGRADE_DAYS=30
MIN_HQ_ACTIVATION_RATE=60
MIN_FEATURE_USAGE_RATE=70
MIN_PLAN_UPGRADE_RATE=5
FAIL_ON_THRESHOLD=false
REPORT_FILE="/tmp/hms_business_kpi_runtime.md"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --runner) RUNNER="$2"; shift 2 ;;
    --database-url) DATABASE_URL="$2"; shift 2 ;;
    --window-hq-days) WINDOW_HQ_DAYS="$2"; shift 2 ;;
    --window-flags-days) WINDOW_FLAGS_DAYS="$2"; shift 2 ;;
    --window-upgrade-days) WINDOW_UPGRADE_DAYS="$2"; shift 2 ;;
    --min-hq-activation-rate) MIN_HQ_ACTIVATION_RATE="$2"; shift 2 ;;
    --min-feature-usage-rate) MIN_FEATURE_USAGE_RATE="$2"; shift 2 ;;
    --min-plan-upgrade-rate) MIN_PLAN_UPGRADE_RATE="$2"; shift 2 ;;
    --fail-on-threshold) FAIL_ON_THRESHOLD=true; shift ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

for n in \
  "$WINDOW_HQ_DAYS" "$WINDOW_FLAGS_DAYS" "$WINDOW_UPGRADE_DAYS" \
  "$MIN_HQ_ACTIVATION_RATE" "$MIN_FEATURE_USAGE_RATE" "$MIN_PLAN_UPGRADE_RATE"
do
  if ! [[ "$n" =~ ^[0-9]+$ ]]; then
    echo "Numeric option expected integer; got: $n" >&2
    exit 1
  fi
done

resolve_runner() {
  local docker_ready=false
  local host_ready=false

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker compose config --services 2>/dev/null | grep -qx db; then
      docker_ready=true
    elif docker ps -a --format "{{.Names}}" | grep -qx "hms-db"; then
      docker_ready=true
    fi
  fi

  if command -v psql >/dev/null 2>&1; then
    host_ready=true
  fi

  case "$RUNNER" in
    docker)
      if [[ "$docker_ready" != "true" ]]; then
        echo "docker runner requested but docker compose db service is unavailable." >&2
        exit 1
      fi
      echo "docker"
      ;;
    host)
      if [[ "$host_ready" != "true" ]]; then
        echo "host runner requested but psql is unavailable." >&2
        exit 1
      fi
      echo "host"
      ;;
    auto)
      if [[ "$docker_ready" == "true" ]]; then
        echo "docker"
      elif [[ "$host_ready" == "true" ]]; then
        echo "host"
      else
        echo "Unable to resolve KPI runner: neither docker(db) nor host psql are available." >&2
        exit 1
      fi
      ;;
    *)
      echo "Invalid --runner value: $RUNNER (expected auto|host|docker)" >&2
      exit 1
      ;;
  esac
}

RUNNER_RESOLVED="$(resolve_runner)"

run_sql() {
  local sql="$1"
  local result=""
  local status=0
  if [[ "$RUNNER_RESOLVED" == "docker" ]]; then
    docker compose up -d db >/dev/null 2>&1 || true
    set +e
    result="$(docker compose exec -T db psql -U admin -d hms_core -tA -c "$sql" 2>/dev/null)"
    status=$?
    if [[ "$status" -ne 0 ]] && docker ps -a --format "{{.Names}}" | grep -qx "hms-db"; then
      result="$(docker exec hms-db psql -U admin -d hms_core -tA -c "$sql" 2>/dev/null)"
      status=$?
    fi
    set -e
  else
    set +e
    result="$(psql "$DATABASE_URL" -tA -c "$sql" 2>/dev/null)"
    status=$?
    set -e
  fi
  if [[ "$status" -ne 0 ]]; then
    echo ""
    return 0
  fi
  echo "$result" | tr -d '[:space:]'
}

to_int_or_zero() {
  local v="${1:-}"
  if [[ -z "$v" ]]; then
    echo "0"
  elif [[ "$v" =~ ^-?[0-9]+$ ]]; then
    echo "$v"
  else
    echo "0"
  fi
}

enterprise_total="$(to_int_or_zero "$(run_sql "SELECT COUNT(*) FROM hotels WHERE upper(plan_tier) = 'ENTERPRISE';")")"
enterprise_active_hq="$(to_int_or_zero "$(run_sql "SELECT COUNT(DISTINCT hotel_id) FROM audit_events WHERE action = 'ui_event:network_kpis_viewed' AND created_at >= NOW() - INTERVAL '${WINDOW_HQ_DAYS} days';")")"

total_hotels="$(to_int_or_zero "$(run_sql "SELECT COUNT(*) FROM hotels;")")"
flags_usage_tenants="$(to_int_or_zero "$(run_sql "SELECT COUNT(DISTINCT hotel_id) FROM audit_events WHERE action = 'feature_flags_read' AND created_at >= NOW() - INTERVAL '${WINDOW_FLAGS_DAYS} days';")")"

upgrades_30d="$(to_int_or_zero "$(run_sql "SELECT COUNT(DISTINCT hotel_id) FROM audit_events WHERE action = 'plan_upgrade_pro_to_enterprise' AND created_at >= NOW() - INTERVAL '${WINDOW_UPGRADE_DAYS} days';")")"
current_pro="$(to_int_or_zero "$(run_sql "SELECT COUNT(*) FROM hotels WHERE upper(plan_tier) = 'PRO';")")"
eligible_pro=$((current_pro + upgrades_30d))

calc_percent() {
  local num="$1"
  local den="$2"
  awk -v n="$num" -v d="$den" 'BEGIN { if (d<=0) { printf "0.00" } else { printf "%.2f", (n*100.0)/d } }'
}

hq_rate="$(calc_percent "$enterprise_active_hq" "$enterprise_total")"
flags_rate="$(calc_percent "$flags_usage_tenants" "$total_hotels")"
upgrade_rate="$(calc_percent "$upgrades_30d" "$eligible_pro")"

hq_status="PASS"
flags_status="PASS"
upgrade_status="PASS"

if [[ "$enterprise_total" -gt 0 ]]; then
  if ! awk -v x="$hq_rate" -v y="$MIN_HQ_ACTIVATION_RATE" 'BEGIN { exit (x>=y)?0:1 }'; then
    hq_status="FAIL"
  fi
fi

if [[ "$total_hotels" -gt 0 ]]; then
  if ! awk -v x="$flags_rate" -v y="$MIN_FEATURE_USAGE_RATE" 'BEGIN { exit (x>=y)?0:1 }'; then
    flags_status="FAIL"
  fi
fi

if [[ "$eligible_pro" -gt 0 ]]; then
  if ! awk -v x="$upgrade_rate" -v y="$MIN_PLAN_UPGRADE_RATE" 'BEGIN { exit (x>=y)?0:1 }'; then
    upgrade_status="FAIL"
  fi
fi

overall_status="PASS"
if [[ "$hq_status" == "FAIL" || "$flags_status" == "FAIL" || "$upgrade_status" == "FAIL" ]]; then
  overall_status="FAIL"
fi

mkdir -p "$(dirname "$REPORT_FILE")"
{
  echo "# Business KPI Runtime Report"
  echo
  echo "- generated_at_utc: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- runner: $RUNNER_RESOLVED"
  if [[ "$RUNNER_RESOLVED" == "host" ]]; then
    echo "- database_url: $DATABASE_URL"
  fi
  echo
  echo "## B1. kpi_hq_activation_rate"
  echo "- enterprise_tenants: $enterprise_total"
  echo "- enterprise_tenants_active_hq_${WINDOW_HQ_DAYS}d: $enterprise_active_hq"
  echo "- value_percent: $hq_rate"
  echo "- threshold_percent: $MIN_HQ_ACTIVATION_RATE"
  echo "- status: $hq_status"
  echo
  echo "## B2. kpi_feature_flags_usage_rate"
  echo "- total_hotels: $total_hotels"
  echo "- hotels_with_feature_flags_read_${WINDOW_FLAGS_DAYS}d: $flags_usage_tenants"
  echo "- value_percent: $flags_rate"
  echo "- threshold_percent: $MIN_FEATURE_USAGE_RATE"
  echo "- status: $flags_status"
  echo
  echo "## B3. kpi_plan_upgrade_rate"
  echo "- current_pro_hotels: $current_pro"
  echo "- upgrades_pro_to_enterprise_${WINDOW_UPGRADE_DAYS}d: $upgrades_30d"
  echo "- eligible_pro_baseline: $eligible_pro"
  echo "- value_percent: $upgrade_rate"
  echo "- threshold_percent: $MIN_PLAN_UPGRADE_RATE"
  echo "- status: $upgrade_status"
  echo
  echo "- overall_status: $overall_status"
} > "$REPORT_FILE"

cat "$REPORT_FILE"
echo
echo "Report written to: $REPORT_FILE"

if [[ "$FAIL_ON_THRESHOLD" == "true" && "$overall_status" != "PASS" ]]; then
  echo "business-kpi-runtime-check: FAIL (threshold breach)" >&2
  exit 1
fi

echo "business-kpi-runtime-check: PASS"
