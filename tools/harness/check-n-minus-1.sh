#!/usr/bin/env bash
# N-1: the previous release's tests must pass against this PR's schema, so code rollback never needs schema rollback.
# Expects the database to be migrated by this PR already.
set -euo pipefail
BASE="${HG_BASE:-origin/${GITHUB_BASE_REF:-main}}"
DIR="$(mktemp -d)/base"
git worktree add --detach "$DIR" "$BASE" >/dev/null
trap 'git worktree remove --force "$DIR"' EXIT
if [ ! -f "$DIR/tools/harness/vitest.config.mts" ]; then
  echo "check-n-minus-1: base has no test harness yet; skipped"
  exit 0
fi
cd "$DIR"
pnpm install --frozen-lockfile --silent
pnpm -s gen
HG_SKIP_MIGRATE=1 HG_RECORD_FILE= pnpm exec vitest run -c tools/harness/vitest.config.mts
echo "check-n-minus-1: ok"
