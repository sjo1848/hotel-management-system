#!/usr/bin/env bash
set -euo pipefail
[[ "${ALLOW_DATABASE_OPERATIONS:-}" == true ]] || { echo "Set ALLOW_DATABASE_OPERATIONS=true" >&2; exit 1; }
[[ "${MAINTENANCE_MODE:-}" == true ]] || { echo "Set MAINTENANCE_MODE=true" >&2; exit 1; }
[[ -n "${MIGRATION_COMMAND:-}" ]] || { echo "MIGRATION_COMMAND is required" >&2; exit 1; }
[[ "${MIGRATION_CONFIRMATION:-}" == APPLY-MIGRATIONS ]] || { echo "Set MIGRATION_CONFIRMATION=APPLY-MIGRATIONS" >&2; exit 1; }
bash -c "$MIGRATION_COMMAND"; echo "Migration command completed; run contract and smoke checks before traffic."
