#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--repo owner/name] [--workflow file.yml] [--runs N] [--output FILE]
          [--min-success-rate 0.00-1.00] [--min-consecutive-success N] [--fail-on-threshold]

Fetches GitHub Actions workflow runs and summarizes stability metrics.
USAGE
}

REPO="sjo1848/hotel-management-system"
WORKFLOW="full-stack-ci.yml"
RUNS=20
OUTPUT=""
MIN_SUCCESS_RATE=""
MIN_CONSECUTIVE_SUCCESS=""
FAIL_ON_THRESHOLD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --workflow) WORKFLOW="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --min-success-rate) MIN_SUCCESS_RATE="$2"; shift 2 ;;
    --min-consecutive-success) MIN_CONSECUTIVE_SUCCESS="$2"; shift 2 ;;
    --fail-on-threshold) FAIL_ON_THRESHOLD=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! [[ "$RUNS" =~ ^[0-9]+$ ]]; then
  echo "--runs must be numeric" >&2
  exit 1
fi
if [[ -n "$MIN_SUCCESS_RATE" ]] && ! [[ "$MIN_SUCCESS_RATE" =~ ^0(\.[0-9]+)?$|^1(\.0+)?$ ]]; then
  echo "--min-success-rate must be between 0 and 1 (e.g. 0.80)" >&2
  exit 1
fi
if [[ -n "$MIN_CONSECUTIVE_SUCCESS" ]] && ! [[ "$MIN_CONSECUTIVE_SUCCESS" =~ ^[0-9]+$ ]]; then
  echo "--min-consecutive-success must be numeric" >&2
  exit 1
fi

TMP_JSON="$(mktemp)"
cleanup(){ rm -f "$TMP_JSON"; }
trap cleanup EXIT

AUTH_HEADER=()
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
fi

curl -sS "${AUTH_HEADER[@]}" "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${RUNS}" > "$TMP_JSON"

report="$(python3 - <<'PY' "$TMP_JSON" "$REPO" "$MIN_SUCCESS_RATE" "$MIN_CONSECUTIVE_SUCCESS"
import json, os, sys, urllib.request
from collections import Counter

path, repo = sys.argv[1], sys.argv[2]
min_success_rate_raw = sys.argv[3]
min_consecutive_success_raw = sys.argv[4]
min_success_rate = float(min_success_rate_raw) if min_success_rate_raw else None
min_consecutive_success = int(min_consecutive_success_raw) if min_consecutive_success_raw else None

github_token = os.getenv("GITHUB_TOKEN", "")
current_run_id_raw = os.getenv("GITHUB_RUN_ID", "")
current_run_id = int(current_run_id_raw) if current_run_id_raw.isdigit() else None
headers = {"Authorization": f"Bearer {github_token}"} if github_token else {}

with open(path) as f:
    data = json.load(f)

runs_all = data.get("workflow_runs", [])
runs = [r for r in runs_all if r.get("status") == "completed"]
current_run_in_progress = any(
    r.get("id") == current_run_id and r.get("status") != "completed"
    for r in runs_all
) if current_run_id is not None else False

if not runs:
    print("No completed runs found")
    raise SystemExit(0)

base = f"https://api.github.com/repos/{repo}"
jobs_cache = {}

def fetch_jobs(run_id):
    if run_id in jobs_cache:
        return jobs_cache[run_id]
    req = urllib.request.Request(base + f"/actions/runs/{run_id}/jobs?per_page=100", headers=headers)
    with urllib.request.urlopen(req) as jr:
        jobs_cache[run_id] = json.load(jr).get("jobs", [])
    return jobs_cache[run_id]

def effective_conclusion(run):
    conc = run.get("conclusion") or "null"
    if conc != "failure":
        return conc
    failed_jobs = [
        j for j in fetch_jobs(run["id"])
        if j.get("conclusion") and j.get("conclusion") != "success"
    ]
    if failed_jobs and all(j.get("name") == "CI Stability Guard" for j in failed_jobs):
        return "success"
    return conc

effective = {r["id"]: effective_conclusion(r) for r in runs}
conc = Counter(effective.values())
ok = conc.get("success", 0)
failed = conc.get("failure", 0)
success_rate = ok / len(runs)
consecutive_success = 0
if current_run_in_progress:
    # When this script runs inside CI Stability Guard, the current run is
    # still in progress but all dependent jobs already succeeded.
    consecutive_success += 1
for r in runs:
    if effective.get(r["id"]) == "success":
        consecutive_success += 1
    else:
        break

out = []
out.append("# CI Stability Report")
out.append("")
out.append(f"- runs_requested: {len(runs_all)}")
out.append(f"- runs_analyzed_completed: {len(runs)}")
out.append(f"- success: {ok}")
out.append(f"- failure: {failed}")
out.append(f"- success_rate: {success_rate:.2%}")
out.append(f"- consecutive_success: {consecutive_success}")
if current_run_in_progress:
    out.append(f"- consecutive_success_includes_current_in_progress: true")
if min_success_rate is not None:
    out.append(f"- threshold_min_success_rate: {min_success_rate:.2%}")
if min_consecutive_success is not None:
    out.append(f"- threshold_min_consecutive_success: {min_consecutive_success}")
out.append("")
out.append("## Latest Runs")
for r in runs[:5]:
    out.append(
        f"- id={r['id']} conclusion={r.get('conclusion')} "
        f"effective={effective.get(r['id'])} sha={r['head_sha'][:7]} created_at={r['created_at']}"
    )

job_fail = Counter()
step_fail = Counter()

for r in [x for x in runs if effective.get(x["id"]) == "failure"][:10]:
    jobs = fetch_jobs(r["id"])
    for j in jobs:
        if j.get("conclusion") and j.get("conclusion") != "success":
            job_fail[j.get("name", "unknown")] += 1
            for s in j.get("steps", []):
                c = s.get("conclusion")
                if c and c not in ("success", "skipped"):
                    step_fail[f"{j.get('name','unknown')} :: {s.get('name','unknown')}"] += 1

out.append("")
out.append("## Top Failing Jobs")
if job_fail:
    for name, count in job_fail.most_common(5):
        out.append(f"- {name}: {count}")
else:
    out.append("- none")

out.append("")
out.append("## Top Failing Steps")
if step_fail:
    for name, count in step_fail.most_common(8):
        out.append(f"- {name}: {count}")
else:
    out.append("- none")

pass_success_rate = True if min_success_rate is None else success_rate >= min_success_rate
pass_consecutive = True if min_consecutive_success is None else consecutive_success >= min_consecutive_success
overall_pass = pass_success_rate and pass_consecutive

out.append("")
out.append("## Threshold Evaluation")
out.append(f"- success_rate_check: {'PASS' if pass_success_rate else 'FAIL'}")
out.append(f"- consecutive_success_check: {'PASS' if pass_consecutive else 'FAIL'}")
out.append(f"- overall: {'PASS' if overall_pass else 'FAIL'}")
out.append(f"OVERALL_STATUS={'PASS' if overall_pass else 'FAIL'}")

print("\n".join(out))
PY
)"

if [[ -n "$OUTPUT" ]]; then
  mkdir -p "$(dirname "$OUTPUT")"
  printf "%s\n" "$report" > "$OUTPUT"
  echo "Report written to: $OUTPUT"
else
  printf "%s\n" "$report"
fi

if [[ "$FAIL_ON_THRESHOLD" == "true" ]] && grep -q "OVERALL_STATUS=FAIL" <<<"$report"; then
  echo "Threshold gate failed." >&2
  exit 2
fi
