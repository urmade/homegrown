#!/usr/bin/env bash
# Merge gate: exits 0 only when every required CI check on the SHA has completed with success.
# Red exits 2 at once; missing or pending checks are polled until the timeout, then exit 3.
# Usage: merge-gate.sh <sha> [timeout-seconds]. Needs GH_TOKEN with checks: read and GITHUB_REPOSITORY.
# CHECK_RUNS_JSON (a check-runs API response) replaces the API call, for tests.
set -euo pipefail
SHA="$1"
TIMEOUT="${2:-2700}"
INTERVAL="${MERGE_GATE_INTERVAL:-20}"
# The ci.yml jobs that gate a merge; drift only posts a comment.
REQUIRED="static db e2e docker-arm64"

verdict() {
  jq -r --arg req "$REQUIRED" '
    [.check_runs[] | {name, status, conclusion, started_at}] as $runs
    | [ ($req | split(" "))[] as $n
        | ([$runs[] | select(.name == $n)] | sort_by(.started_at) | last) as $r
        | if $r == null then "\($n):missing"
          elif $r.status != "completed" then "\($n):pending"
          elif $r.conclusion == "success" then "\($n):ok"
          else "\($n):red(\($r.conclusion))" end ]
    | (if any(.[]; test(":red")) then "red" elif all(.[]; test(":ok$")) then "green" else "wait" end) + " " + join(" ")'
}

deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  if [ -n "${CHECK_RUNS_JSON:-}" ]; then json="$CHECK_RUNS_JSON"; else json=$(gh api "repos/$GITHUB_REPOSITORY/commits/$SHA/check-runs?per_page=100"); fi
  result=$(verdict <<<"$json")
  echo "merge-gate $SHA: $result"
  case "$result" in
    green*) exit 0 ;;
    red*) exit 2 ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then echo "merge-gate: timed out waiting for required checks"; exit 3; fi
  sleep "$INTERVAL"
done
