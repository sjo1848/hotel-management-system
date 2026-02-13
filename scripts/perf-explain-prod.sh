#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --database-url URL --hotel-id UUID --start-date YYYY-MM-DD --end-date YYYY-MM-DD [options]

Required:
  --database-url URL         PostgreSQL connection string (prefer read replica in prod)
  --hotel-id UUID            Tenant/hotel id to profile
  --start-date YYYY-MM-DD    Report window start date
  --end-date YYYY-MM-DD      Report window end date

Options:
  --room-id UUID             Room id for availability explain (auto-detected if omitted)
  --statement-timeout-ms N   statement_timeout in ms per explain (default: 120000)
  --output-dir DIR           Output directory root (default: artifacts/perf-explain)
  --app-name NAME            application_name prefix (default: hms-explain-prod)
  -h, --help                 Show this help
USAGE
}

DATABASE_URL="${DATABASE_URL:-}"
HOTEL_ID=""
START_DATE=""
END_DATE=""
ROOM_ID=""
STATEMENT_TIMEOUT_MS="120000"
OUTPUT_DIR="artifacts/perf-explain"
APP_NAME="hms-explain-prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database-url) DATABASE_URL="$2"; shift 2 ;;
    --hotel-id) HOTEL_ID="$2"; shift 2 ;;
    --start-date) START_DATE="$2"; shift 2 ;;
    --end-date) END_DATE="$2"; shift 2 ;;
    --room-id) ROOM_ID="$2"; shift 2 ;;
    --statement-timeout-ms) STATEMENT_TIMEOUT_MS="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --app-name) APP_NAME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH" >&2
  exit 1
fi

if [[ -z "$DATABASE_URL" || -z "$HOTEL_ID" || -z "$START_DATE" || -z "$END_DATE" ]]; then
  echo "Missing required flags" >&2
  usage
  exit 1
fi

if ! [[ "$HOTEL_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Invalid --hotel-id (expected UUID format)" >&2
  exit 1
fi
if [[ -n "$ROOM_ID" ]] && ! [[ "$ROOM_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Invalid --room-id (expected UUID format)" >&2
  exit 1
fi
if ! [[ "$START_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Invalid --start-date (expected YYYY-MM-DD)" >&2
  exit 1
fi
if ! [[ "$END_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Invalid --end-date (expected YYYY-MM-DD)" >&2
  exit 1
fi
if ! [[ "$STATEMENT_TIMEOUT_MS" =~ ^[0-9]+$ ]]; then
  echo "Invalid --statement-timeout-ms" >&2
  exit 1
fi

TS="$(date -u +"%Y%m%dT%H%M%SZ")"
RUN_DIR="$OUTPUT_DIR/$TS"
mkdir -p "$RUN_DIR/queries"

if [[ -z "$ROOM_ID" ]]; then
  ROOM_ID="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT id::text FROM rooms WHERE hotel_id = '$HOTEL_ID' ORDER BY created_at DESC NULLS LAST, id LIMIT 1;" | tr -d '[:space:]')"
  if [[ -z "$ROOM_ID" ]]; then
    echo "No room found for hotel_id=$HOTEL_ID. Pass --room-id explicitly." >&2
    exit 1
  fi
fi

cat > "$RUN_DIR/queries/availability_rooms.sql" <<SQL
SELECT r.id, r.hotel_id, r.room_number, r.room_type, r.status, r.price_cents
FROM rooms r
WHERE r.hotel_id = '$HOTEL_ID'::uuid
  AND r.status = 'AVAILABLE'
  AND NOT EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.hotel_id = '$HOTEL_ID'::uuid
        AND b.room_id = r.id
        AND b.check_in < '$END_DATE'::date
        AND b.check_out > '$START_DATE'::date
        AND b.status != 'CANCELLED'
  );
SQL

cat > "$RUN_DIR/queries/check_availability_exists.sql" <<SQL
SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE hotel_id = '$HOTEL_ID'::uuid
      AND room_id = '$ROOM_ID'::uuid
      AND status != 'CANCELLED'
      AND check_in < '$END_DATE'::date
      AND check_out > '$START_DATE'::date
) AS has_overlap;
SQL

cat > "$RUN_DIR/queries/revenue_report.sql" <<SQL
SELECT check_in AS date, SUM(total_price_cents)::BIGINT AS revenue_cents
FROM bookings
WHERE hotel_id = '$HOTEL_ID'::uuid
  AND status != 'CANCELLED'
  AND check_in >= '$START_DATE'::date
  AND check_in <= '$END_DATE'::date
GROUP BY check_in
ORDER BY check_in ASC;
SQL

cat > "$RUN_DIR/queries/occupancy_report.sql" <<SQL
WITH dates AS (
    SELECT generate_series('$START_DATE'::date, '$END_DATE'::date, '1 day'::interval)::date AS day
),
room_counts AS (
    SELECT count(*) AS total FROM rooms WHERE hotel_id = '$HOTEL_ID'::uuid
)
SELECT
    d.day AS date,
    (SELECT count(DISTINCT room_id)
     FROM bookings
     WHERE hotel_id = '$HOTEL_ID'::uuid
       AND status IN ('CONFIRMED', 'CHECKED_IN')
       AND check_in <= d.day
       AND check_out > d.day) AS occupied_rooms,
    rc.total AS total_rooms
FROM dates d, room_counts rc
ORDER BY d.day ASC;
SQL

run_explain() {
  local name="$1"
  local query_file="$RUN_DIR/queries/$name.sql"
  local plan_file="$RUN_DIR/${name}.plan.txt"

  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -P pager=off > "$plan_file" <<SQL
BEGIN READ ONLY;
SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}ms';
SET LOCAL application_name = '${APP_NAME}:${name}';
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
$(cat "$query_file")
ROLLBACK;
SQL

  local planning execution
  planning="$(awk -F': ' '/Planning Time:/ {print $2}' "$plan_file" | tail -n1 | xargs || true)"
  execution="$(awk -F': ' '/Execution Time:/ {print $2}' "$plan_file" | tail -n1 | xargs || true)"
  if [[ -z "$planning" ]]; then planning="n/a"; fi
  if [[ -z "$execution" ]]; then execution="n/a"; fi

  printf "%s|%s|%s\n" "$name" "$planning" "$execution"
}

RESULTS=()
for q in availability_rooms check_availability_exists revenue_report occupancy_report; do
  RESULTS+=("$(run_explain "$q")")
done

NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
REPORT="$RUN_DIR/report.md"

{
  echo "# HMS Prod Explain Analyze"
  echo
  echo "- generated_at_utc: $NOW_ISO"
  echo "- app_name: $APP_NAME"
  echo "- hotel_id: $HOTEL_ID"
  echo "- room_id: $ROOM_ID"
  echo "- range: $START_DATE..$END_DATE"
  echo "- statement_timeout_ms: $STATEMENT_TIMEOUT_MS"
  echo
  echo "| query | planning_time | execution_time | raw_plan |"
  echo "|---|---:|---:|---|"
  for row in "${RESULTS[@]}"; do
    IFS='|' read -r name planning execution <<< "$row"
    echo "| $name | $planning | $execution | ${name}.plan.txt |"
  done
  echo
  echo "## Notes"
  echo "- Ejecutar contra replica read-only o ventana de bajo impacto."
  echo "- Comparar resultados con baseline previa y con SLO p95 definido para cada endpoint." 
} > "$REPORT"

echo "Explain report generated: $REPORT"
