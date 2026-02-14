#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-frontend/dist/assets}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Frontend perf budget: dist folder not found at '$DIST_DIR'." >&2
  echo "Run frontend build first (npm run build)." >&2
  exit 1
fi

VENDOR_MAX_KB="${VENDOR_MAX_KB:-550}"
CHARTS_MAX_KB="${CHARTS_MAX_KB:-250}"
APP_MAX_KB="${APP_MAX_KB:-180}"
CSS_MAX_KB="${CSS_MAX_KB:-100}"

pick_asset() {
  local pattern="$1"
  local file
  file="$(find "$DIST_DIR" -maxdepth 1 -type f -name "$pattern" | sort | head -n 1 || true)"
  echo "$file"
}

size_kb() {
  local file="$1"
  stat -c%s "$file" | awk '{ printf "%.2f", $1 / 1024 }'
}

assert_budget() {
  local name="$1"
  local file="$2"
  local max_kb="$3"

  if [[ -z "$file" || ! -f "$file" ]]; then
    echo "Frontend perf budget: missing asset for $name." >&2
    return 1
  fi

  local current_kb
  current_kb="$(size_kb "$file")"
  printf "%-12s %8s KB (max %s KB)  %s\n" "$name" "$current_kb" "$max_kb" "$file"

  awk -v cur="$current_kb" -v max="$max_kb" 'BEGIN { exit !(cur <= max) }' || {
    echo "Budget exceeded for $name: ${current_kb}KB > ${max_kb}KB" >&2
    return 1
  }
}

vendor_file="$(pick_asset 'vendor-*.js')"
charts_file="$(pick_asset 'charts-*.js')"
app_file="$(pick_asset 'index-*.js')"
css_file="$(pick_asset 'index-*.css')"

echo "Frontend performance budgets:"
assert_budget "vendor_js" "$vendor_file" "$VENDOR_MAX_KB"
assert_budget "charts_js" "$charts_file" "$CHARTS_MAX_KB"
assert_budget "app_js" "$app_file" "$APP_MAX_KB"
assert_budget "app_css" "$css_file" "$CSS_MAX_KB"

echo "Frontend perf budget gate passed."
