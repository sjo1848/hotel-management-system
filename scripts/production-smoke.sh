#!/usr/bin/env bash
set -euo pipefail
DB_NAME=hms_core; DB_USER="${DB_USER:-}"; SMOKE_DATABASE_URL="${SMOKE_DATABASE_URL:-${DATABASE_URL:-${BACKUP_DATABASE_URL:-}}}"
while [[ $# -gt 0 ]]; do case "$1" in --db) DB_NAME="$2"; shift 2;; --db-user) DB_USER="$2"; shift 2;; *) exit 1;; esac; done
if [[ -z "$SMOKE_DATABASE_URL" ]]; then
  [[ -n "$DB_USER" ]] || { echo "DB_USER is required for docker fallback" >&2; exit 1; }
  command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
fi
for table in ${MATERIAL_HMS_TABLES:-hotels users rooms guests bookings invoices payment_entries}; do
  query="SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname='public' AND c.relname='${table}';"
  if [[ -n "$SMOKE_DATABASE_URL" ]]; then value="$(psql "$SMOKE_DATABASE_URL" -tAqc "$query")"; else value="$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAqc "$query")"; fi
  [[ "$value" == 1 ]] || { echo "Missing material table: $table" >&2; exit 1; }
done
echo "Database smoke verification PASS"
