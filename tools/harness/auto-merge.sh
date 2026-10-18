#!/usr/bin/env bash
# Auto-merge sweep. Runs from main's checkout only (workflow_run, schedule, workflow_dispatch); PR code is
# fetched for git diff and never executed. Every invocation re-evaluates main and every open PR, so a missed
# or dropped event is caught by the next run. DRY_RUN=1 prints actions without taking them.
set -uo pipefail
R="$GITHUB_REPOSITORY"
HERE="$(cd "$(dirname "$0")" && pwd)"
MARK="<!-- homegrown-auto-merge -->"

log() { echo "auto-merge: $*"; }
act() { if [ "${DRY_RUN:-0}" = 1 ]; then log "DRY_RUN would: $*"; else "$@"; fi; }
gate() { bash "$HERE/merge-gate.sh" "$1"; }
main_sha() { gh api "repos/$R/commits/main" --jq .sha; }

# Flaky or cancelled jobs get exactly one automatic retry per SHA; a second red stays red.
retry_or_report() {
  local what=$1 verdict=$2 run attempt
  read -r _ run attempt <<<"$verdict"
  if [ "$attempt" = 1 ]; then
    act gh api -X POST "repos/$R/actions/runs/$run/rerun-failed-jobs" >/dev/null && log "$what: ci run $run red on attempt 1; re-running failed jobs"
    return 1
  fi
  return 0
}

comment_once() {
  local pr=$1 key=$2 body=$3
  if gh api "repos/$R/issues/$pr/comments?per_page=100" --jq '.[].body' | grep -qF "$MARK $key"; then return; fi
  act gh pr comment "$pr" --body "$MARK $key
$body" >/dev/null
}

check_main() {
  local sha verdict issue
  sha=$(main_sha)
  verdict=$(gate "$sha")
  issue=$(gh issue list --state open --search '"main is red" in:title' --json number --jq '.[0].number // empty')
  case "$verdict" in
    missing) act gh workflow run ci.yml --ref main && log "main $sha has no ci run; dispatched one" ;;
    pending) log "main $sha: ci pending" ;;
    green)
      log "main $sha: green"
      [ -n "$issue" ] && act gh issue close "$issue" --comment "main is green again at $sha." ;;
    red*)
      if retry_or_report "main $sha" "$verdict" && [ -z "$issue" ]; then
        act gh issue create --title "main is red" --body "ci failed twice on main at $sha (run ${verdict#red }). The deploy agent will not deploy it. Fix forward with the build-feature skill."
        log "main $sha: red after retry; opened issue"
      fi ;;
  esac
}

sweep_prs() {
  local prs pr head branch verdict behind new
  prs=$(gh pr list --base main --state open --limit 100 --json number,isDraft,isCrossRepository,headRefOid,headRefName \
    --jq '.[] | select((.isDraft | not) and (.isCrossRepository | not)) | "\(.number) \(.headRefOid) \(.headRefName)"')
  while read -r pr head branch; do
    [ -z "${pr:-}" ] && continue
    git fetch -q origin "+refs/pull/$pr/head:refs/remotes/pr/$pr" main || { log "#$pr: fetch failed"; continue; }
    if git diff --name-only --no-renames "origin/main...$head" | bash "$HERE/is-harness.sh"; then
      log "#$pr: harness PR; waits for owner review"
      continue
    fi
    verdict=$(gate "$head")
    case "$verdict" in
      missing) act gh workflow run ci.yml --ref "$branch" && log "#$pr: no ci run for $head; dispatched one"; continue ;;
      pending) log "#$pr: ci pending for $head"; continue ;;
      red*) retry_or_report "#$pr" "$verdict" && log "#$pr: ci red for $head; not merging"; continue ;;
    esac
    behind=$(gh api "repos/$R/compare/$head...main" --jq .ahead_by)
    if [ "$behind" != 0 ]; then
      if [ "${DRY_RUN:-0}" = 1 ]; then log "DRY_RUN would: update #$pr ($behind behind main) and dispatch ci"; continue; fi
      if err=$(gh api -X PUT "repos/$R/pulls/$pr/update-branch" -f expected_head_sha="$head" 2>&1); then
        for _ in $(seq 30); do new=$(gh api "repos/$R/pulls/$pr" --jq .head.sha); [ "$new" != "$head" ] && break; sleep 2; done
        gh workflow run ci.yml --ref "$branch"
        log "#$pr: $behind behind main; updated branch to ${new:-?} and dispatched ci"
      else
        comment_once "$pr" "update-failed:$head" "Auto-merge could not bring this branch up to date with \`main\` (\`$(echo "$err" | tr '\n' ' ' | head -c 200)\`). Merge \`main\` into the branch, resolve conflicts and push; the gate re-runs on the next CI completion."
        log "#$pr: update-branch failed"
      fi
      continue
    fi
    if act gh pr merge "$pr" --squash --match-head-commit "$head"; then
      act gh workflow run ci.yml --ref main
      git fetch -q origin main
      log "#$pr: merged $head as $(main_sha); dispatched ci on main"
    else
      log "#$pr: merge refused"
    fi
  done <<<"$prs"
}

check_main
sweep_prs
