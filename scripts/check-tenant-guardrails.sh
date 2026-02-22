#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/Cargo.toml" ]; then
  echo "Run from repo root."
  exit 1
fi

required_tenant_files=(
  "backend/src/infrastructure/repository/postgres.rs"
  "backend/src/infrastructure/repository/postgres_guest.rs"
  "backend/src/infrastructure/repository/postgres_extra_charge.rs"
  "backend/src/infrastructure/repository/postgres_cash_closure.rs"
  "backend/src/infrastructure/repository/postgres_audit.rs"
  "backend/src/infrastructure/repository/postgres_user.rs"
  "backend/src/infrastructure/repository/postgres_booking.rs"
  "backend/src/infrastructure/repository/postgres_invoice.rs"
  "backend/src/infrastructure/repository/postgres_refresh_token.rs"
)

for file in "${required_tenant_files[@]}"; do
  if ! grep -q "begin_tenant_tx" "$file"; then
    echo "Tenant guardrail missing begin_tenant_tx usage in $file" >&2
    exit 1
  fi
done

if ! grep -q "apply_tenant_context(&mut tx" backend/src/infrastructure/repository/postgres_booking_transaction.rs; then
  echo "Tenant guardrail missing apply_tenant_context in transactional booking repository." >&2
  exit 1
fi

bypass_usages="$(grep -R --line-number "begin_bypass_tx" backend/src/infrastructure/repository || true)"
if [[ -n "$bypass_usages" ]]; then
  echo "Unexpected begin_bypass_tx usage detected (RLS bypass must remain disabled):" >&2
  echo "$bypass_usages" >&2
  exit 1
fi

rls_bypass_setters="$(grep -R --line-number "set_config('app.rls_bypass', 'true'" backend/src/infrastructure/repository | grep -v "tenant_context.rs" || true)"
if [[ -n "$rls_bypass_setters" ]]; then
  echo "Unexpected direct RLS bypass setter outside tenant_context helper:" >&2
  echo "$rls_bypass_setters" >&2
  exit 1
fi

echo "Tenant guardrails check passed."
