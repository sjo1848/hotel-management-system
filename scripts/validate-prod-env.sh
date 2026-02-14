#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --env-file .env.prod
Compatibility wrapper for production profile validation.
USAGE
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

exec ./scripts/validate-env-profile.sh --profile prod "$@"
