#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/backend/migrations"
LEGACY_INIT="$ROOT_DIR/database/init.sql"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

if [[ ! -f "$LEGACY_INIT" ]]; then
  echo "Legacy init file not found: $LEGACY_INIT" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

migrations_list="$tmp_dir/migrations.txt"
legacy_includes="$tmp_dir/legacy_includes.txt"
missing_in_legacy="$tmp_dir/missing_in_legacy.txt"
missing_in_migrations="$tmp_dir/missing_in_migrations.txt"

find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort > "$migrations_list"

awk '
  /^\s*\\ir[[:space:]]+\.\.\/backend\/migrations\// {
    gsub(/^\s*\\ir[[:space:]]+\.\.\/backend\/migrations\//, "", $0)
    print $0
  }
' "$LEGACY_INIT" | sort > "$legacy_includes"

comm -23 "$migrations_list" "$legacy_includes" > "$missing_in_legacy"
comm -13 "$migrations_list" "$legacy_includes" > "$missing_in_migrations"

if [[ -s "$missing_in_legacy" || -s "$missing_in_migrations" ]]; then
  echo "Legacy schema convergence check failed." >&2
  if [[ -s "$missing_in_legacy" ]]; then
    echo >&2
    echo "Migrations missing in database/init.sql:" >&2
    cat "$missing_in_legacy" >&2
  fi
  if [[ -s "$missing_in_migrations" ]]; then
    echo >&2
    echo "Entries in database/init.sql not found in backend/migrations:" >&2
    cat "$missing_in_migrations" >&2
  fi
  exit 1
fi

echo "Legacy schema convergence check passed."
