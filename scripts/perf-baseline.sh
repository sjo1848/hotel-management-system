#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [options]

Options:
  --base-url URL           API base URL (default: http://localhost:3001)
  --requests N             Requests per endpoint (default: 4)
  --concurrency N          Parallel workers per endpoint (default: 1)
  --warmup N               Warmup requests per endpoint (default: 1)
  --admin-user USER        Login user (default: ADMIN_USER from .env or admin)
  --admin-password PASS    Login password (default: ADMIN_PASSWORD from .env or admin123)
  --hotel-id ID            Hotel id/name for login (default: 00000000-0000-0000-0000-000000000001)
  --slo-p95-sec SEC        P95 SLO threshold in seconds (default: 1.0)
  --slo-error-rate RATE    Error-rate SLO threshold (default: 0.05)
  --fail-on-slo            Exit with non-zero status when any endpoint breaks SLO
  --report FILE            Write markdown report to file
  -h, --help               Show this help
USAGE
}

BASE_URL="http://localhost:3001"
REQUESTS=4
CONCURRENCY=1
WARMUP=1
HOTEL_ID="00000000-0000-0000-0000-000000000001"
SLO_P95_SEC="1.0"
SLO_ERROR_RATE="0.05"
FAIL_ON_SLO=0
REPORT_FILE=""

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

ADMIN_USER_VAL="${ADMIN_USER:-admin}"
ADMIN_PASSWORD_VAL="${ADMIN_PASSWORD:-admin123}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --requests) REQUESTS="$2"; shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
    --warmup) WARMUP="$2"; shift 2 ;;
    --admin-user) ADMIN_USER_VAL="$2"; shift 2 ;;
    --admin-password) ADMIN_PASSWORD_VAL="$2"; shift 2 ;;
    --hotel-id) HOTEL_ID="$2"; shift 2 ;;
    --slo-p95-sec) SLO_P95_SEC="$2"; shift 2 ;;
    --slo-error-rate) SLO_ERROR_RATE="$2"; shift 2 ;;
    --fail-on-slo) FAIL_ON_SLO=1; shift ;;
    --report) REPORT_FILE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

for v in REQUESTS CONCURRENCY WARMUP; do
  if ! [[ "${!v}" =~ ^[0-9]+$ ]]; then
    echo "Invalid numeric value for $v: ${!v}" >&2
    exit 1
  fi
done

COOKIE_JAR="$(mktemp)"
LOGIN_BODY="$(mktemp)"
cat > "$LOGIN_BODY" <<JSON
{"hotel_id":"$HOTEL_ID","username":"$ADMIN_USER_VAL","password":"$ADMIN_PASSWORD_VAL"}
JSON

cleanup() {
  rm -f "$COOKIE_JAR" "$LOGIN_BODY"
}
trap cleanup EXIT

wait_for_backend() {
  local tries=20
  local delay=2
  local health_url="$BASE_URL/health"
  local code
  for _ in $(seq 1 "$tries"); do
    code="$(curl -sS -o /dev/null -w "%{http_code}" "$health_url" || true)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    sleep "$delay"
  done
  echo "Backend is not ready at $health_url after $tries attempts." >&2
  return 1
}

wait_for_backend

login_code="000"
for _ in $(seq 1 8); do
  login_code="$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d @"$LOGIN_BODY" \
    -c "$COOKIE_JAR" || true)"
  if [[ "$login_code" == "200" ]]; then
    break
  fi
  sleep 1
done

if [[ "$login_code" != "200" ]]; then
  echo "Login failed with HTTP $login_code. Check credentials/hotel-id." >&2
  exit 1
fi

me_code="$(curl -sS -o /dev/null -w "%{http_code}" \
  -X GET "$BASE_URL/api/v1/auth/me" \
  -b "$COOKIE_JAR")"

if [[ "$me_code" != "200" ]]; then
  echo "Session verification failed at /api/v1/auth/me with HTTP $me_code." >&2
  exit 1
fi

# name|method|path|mode
ENDPOINTS=(
  "bookings_page|GET|/api/v1/bookings/page?limit=25|stateless"
  "guests_page|GET|/api/v1/guests/page?limit=25|stateless"
  "invoices_page|GET|/api/v1/invoices/page?limit=25|stateless"
  "audit_events_page|GET|/api/v1/audit/events/page?limit=50|stateless"
  "bookings_legacy|GET|/api/v1/bookings|stateless"
  "auth_refresh|POST|/api/v1/auth/refresh|stateful_refresh"
  "dashboard_kpis|GET|/api/v1/analytics/kpis|stateless"
  "revenue_report|GET|/api/v1/reports/revenue?start=2026-02-01&end=2026-02-13|stateless"
  "occupancy_report|GET|/api/v1/reports/occupancy?start=2026-02-01&end=2026-02-13|stateless"
)

TMP_DIR="$(mktemp -d)"
trap 'cleanup; rm -rf "$TMP_DIR"' EXIT

bench_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local mode="$4"
  local outfile="$TMP_DIR/$name.out"

  local url="$BASE_URL$path"

  extract_csrf_token() {
    awk '$1 !~ /^#/ && $6 == "csrf_token" { token = $7 } END { if (token != "") print token }' "$COOKIE_JAR"
  }

  local start_ns end_ns duration_sec
  if [[ "$mode" == "stateful_refresh" ]]; then
    if (( WARMUP > 0 )); then
      for _ in $(seq 1 "$WARMUP"); do
        csrf_token="$(extract_csrf_token)"
        if [[ -z "$csrf_token" ]]; then
          echo "Missing csrf_token cookie before warmup for endpoint $name." >&2
          exit 1
        fi
        curl -sS -o /dev/null -X "$method" "$url" \
          -H "Content-Type: application/json" \
          -H "x-csrf-token: $csrf_token" \
          -d '{}' \
          -b "$COOKIE_JAR" \
          -c "$COOKIE_JAR" >/dev/null
      done
    fi

    start_ns="$(date +%s%N)"
    : > "$outfile"
    for _ in $(seq 1 "$REQUESTS"); do
      csrf_token="$(extract_csrf_token)"
      if [[ -z "$csrf_token" ]]; then
        echo "Missing csrf_token cookie before request for endpoint $name." >&2
        exit 1
      fi
      curl -sS -o /dev/null -w "%{time_total} %{http_code}\n" \
        -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "x-csrf-token: $csrf_token" \
        -d '{}' \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" >> "$outfile"
    done
  else
    if (( WARMUP > 0 )); then
      for _ in $(seq 1 "$WARMUP"); do
        curl -sS -o /dev/null -X "$method" "$url" -b "$COOKIE_JAR" >/dev/null
      done
    fi

    start_ns="$(date +%s%N)"
    seq 1 "$REQUESTS" | xargs -I{} -P "$CONCURRENCY" -n1 bash -lc '
      curl -sS -o /dev/null -w "%{time_total} %{http_code}\n" \
        -X "'$method'" "'$url'" -b "'$COOKIE_JAR'"
    ' > "$outfile"
  fi

  end_ns="$(date +%s%N)"
  duration_sec="$(awk -v s="$start_ns" -v e="$end_ns" 'BEGIN { printf "%.6f", (e-s)/1000000000 }')"

  local n sum err avg error_rate rps
  local p50_idx p95_idx p99_idx
  local sorted_file p50 p95 p99 status_summary

  n="$(wc -l < "$outfile" | tr -d ' ')"
  if [[ "$n" -eq 0 ]]; then
    printf "%s|0|0|0|0|0|0|0|0\n" "$name"
    return
  fi

  sum="$(awk '{ s+=$1 } END { printf "%.6f", s+0 }' "$outfile")"
  err="$(awk '{ if ($2 !~ /^2/) e++ } END { print e+0 }' "$outfile")"
  avg="$(awk -v s="$sum" -v n="$n" 'BEGIN { printf "%.6f", s/n }')"
  error_rate="$(awk -v e="$err" -v n="$n" 'BEGIN { printf "%.6f", e/n }')"
  rps="$(awk -v n="$n" -v d="$duration_sec" 'BEGIN { printf "%.6f", n/d }')"

  p50_idx="$(awk -v n="$n" 'BEGIN { print int((n*0.50)+0.999) }')"
  p95_idx="$(awk -v n="$n" 'BEGIN { print int((n*0.95)+0.999) }')"
  p99_idx="$(awk -v n="$n" 'BEGIN { print int((n*0.99)+0.999) }')"

  sorted_file="$TMP_DIR/$name.sorted"
  awk '{ print $1 }' "$outfile" | sort -n > "$sorted_file"
  p50="$(awk -v i="$p50_idx" 'NR==i { printf "%.6f", $1; exit }' "$sorted_file")"
  p95="$(awk -v i="$p95_idx" 'NR==i { printf "%.6f", $1; exit }' "$sorted_file")"
  p99="$(awk -v i="$p99_idx" 'NR==i { printf "%.6f", $1; exit }' "$sorted_file")"
  status_summary="$(
    awk '{ print $2 }' "$outfile" | sort | uniq -c | \
      awk '
        {
          if (NR > 1) printf ",";
          printf "%s:%d", $2, $1;
        }
      ' | tr -d "\n"
  )"

  printf "%s|%d|%s|%s|%s|%s|%s|%s|%s|%s\n" \
    "$name" "$n" "$avg" "$p50" "$p95" "$p99" "$error_rate" "$rps" "$duration_sec" "$status_summary"
}

RESULTS=()
for item in "${ENDPOINTS[@]}"; do
  IFS='|' read -r name method path mode <<< "$item"
  RESULTS+=("$(bench_endpoint "$name" "$method" "$path" "$mode")")
done

now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
report_body=""
report_body+="# Performance Baseline\n\n"
report_body+="- generated_at_utc: $now_iso\n"
report_body+="- base_url: $BASE_URL\n"
report_body+="- requests_per_endpoint: $REQUESTS\n"
report_body+="- concurrency: $CONCURRENCY\n"
report_body+="- warmup: $WARMUP\n"
report_body+="- slo_p95_sec: $SLO_P95_SEC\n"
report_body+="- slo_error_rate: $SLO_ERROR_RATE\n\n"
report_body+="| endpoint | n | avg_s | p50_s | p95_s | p99_s | error_rate | rps | duration_s | http_statuses | slo_p95 | slo_error_rate |\n"
report_body+="|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|\n"

failed_slo_count=0

for row in "${RESULTS[@]}"; do
  IFS='|' read -r endpoint n avg p50 p95 p99 error_rate rps duration http_statuses <<< "$row"

  p95_status="PASS"
  err_status="PASS"

  if awk -v x="$p95" -v y="$SLO_P95_SEC" 'BEGIN { exit (x<=y)?0:1 }'; then :; else p95_status="FAIL"; fi
  if awk -v x="$error_rate" -v y="$SLO_ERROR_RATE" 'BEGIN { exit (x<=y)?0:1 }'; then :; else err_status="FAIL"; fi
  if [[ "$p95_status" == "FAIL" || "$err_status" == "FAIL" ]]; then
    failed_slo_count=$((failed_slo_count + 1))
  fi

  report_body+="| $endpoint | $n | $avg | $p50 | $p95 | $p99 | $error_rate | $rps | $duration | $http_statuses | $p95_status | $err_status |\n"
done

overall_gate="PASS"
if (( failed_slo_count > 0 )); then
  overall_gate="FAIL"
fi
report_body+="\n- gate_result: $overall_gate\n"
report_body+="- endpoints_with_slo_failures: $failed_slo_count\n"

printf "%b" "$report_body"

if [[ -n "$REPORT_FILE" ]]; then
  mkdir -p "$(dirname "$REPORT_FILE")"
  printf "%b" "$report_body" > "$REPORT_FILE"
  echo
  echo "Report written to: $REPORT_FILE"
fi

if (( FAIL_ON_SLO == 1 && failed_slo_count > 0 )); then
  echo "Performance SLO gate failed: $failed_slo_count endpoint(s) outside thresholds." >&2
  exit 1
fi
