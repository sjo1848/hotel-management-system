#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--repo owner/name] [--workflow file.yml] [--runs N] [--output FILE]

Fetches GitHub Actions workflow runs and summarizes stability metrics.
USAGE
}

REPO="sjo1848/hotel-management-system"
WORKFLOW="full-stack-ci.yml"
RUNS=20
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --workflow) WORKFLOW="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! [[ "$RUNS" =~ ^[0-9]+$ ]]; then
  echo "--runs must be numeric" >&2
  exit 1
fi

TMP_JSON="$(mktemp)"
cleanup(){ rm -f "$TMP_JSON"; }
trap cleanup EXIT

curl -sS "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${RUNS}" > "$TMP_JSON"

report="$(python3 - <<'PY' "$TMP_JSON" "$REPO"
import json, sys, urllib.request
from collections import Counter

path, repo = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
runs = data.get('workflow_runs', [])

if not runs:
    print('No runs found')
    raise SystemExit(0)

conc = Counter((r.get('conclusion') or 'null') for r in runs)
ok = conc.get('success', 0)
failed = conc.get('failure', 0)

out = []
out.append('# CI Stability Report')
out.append('')
out.append(f"- runs_analyzed: {len(runs)}")
out.append(f"- success: {ok}")
out.append(f"- failure: {failed}")
out.append(f"- success_rate: {ok/len(runs):.2%}")
out.append('')
out.append('## Latest Runs')
for r in runs[:5]:
    out.append(f"- id={r['id']} conclusion={r.get('conclusion')} sha={r['head_sha'][:7]} created_at={r['created_at']}")

# Analyze job/step failures for failed runs (up to 10 to avoid throttling)
base = f"https://api.github.com/repos/{repo}"
job_fail = Counter()
step_fail = Counter()
for r in [x for x in runs if x.get('conclusion') == 'failure'][:10]:
    rid = r['id']
    with urllib.request.urlopen(base + f"/actions/runs/{rid}/jobs?per_page=100") as jr:
        jobs = json.load(jr).get('jobs', [])
    for j in jobs:
        if j.get('conclusion') and j.get('conclusion') != 'success':
            job_fail[j.get('name', 'unknown')] += 1
            for s in j.get('steps', []):
                c = s.get('conclusion')
                if c and c not in ('success', 'skipped'):
                    step_fail[f"{j.get('name','unknown')} :: {s.get('name','unknown')}"] += 1

out.append('')
out.append('## Top Failing Jobs')
if job_fail:
    for name, count in job_fail.most_common(5):
        out.append(f"- {name}: {count}")
else:
    out.append('- none')

out.append('')
out.append('## Top Failing Steps')
if step_fail:
    for name, count in step_fail.most_common(8):
        out.append(f"- {name}: {count}")
else:
    out.append('- none')

print('\n'.join(out))
PY
)"

if [[ -n "$OUTPUT" ]]; then
  mkdir -p "$(dirname "$OUTPUT")"
  printf "%s\n" "$report" > "$OUTPUT"
  echo "Report written to: $OUTPUT"
else
  printf "%s\n" "$report"
fi
