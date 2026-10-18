#!/usr/bin/env bash
# Merge gate, one shot: prints the verdict for a SHA from the most recently started run of ci.yml.
#   green               latest ci run completed with success
#   red <run> <attempt> latest ci run completed with anything else (failure, cancelled, timed_out, ...)
#   pending             latest ci run not completed
#   missing             no ci run for the SHA
# The deploy agent applies the same rule (packages/deploy-agent isGreen). Every job in ci.yml is required.
# Usage: merge-gate.sh <sha>. Needs GH_TOKEN and GITHUB_REPOSITORY. CI_RUNS_JSON replaces the API call in tests.
set -euo pipefail
SHA="$1"
if [ -n "${CI_RUNS_JSON:-}" ]; then json="$CI_RUNS_JSON"; else json=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$SHA&per_page=100"); fi
# action_required runs (created by bot pushes, waiting for approval) never executed and are ignored.
jq -r '
  ([.workflow_runs[] | select(.conclusion != "action_required")] | sort_by(.run_started_at // .created_at) | last) as $r
  | if $r == null then "missing"
    elif $r.status != "completed" then "pending"
    elif $r.conclusion == "success" then "green"
    else "red \($r.id) \($r.run_attempt)" end' <<<"$json"
