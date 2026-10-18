---
name: upgrade-core
description: Bring an upstream core release into this fork. The only way core/ changes downstream.
---

# Upgrade core

`core/` is vendored and read-only; CI only allows changes on branches named `upgrade-core/<version>`.

1. Branch `upgrade-core/<version>` from main.
2. Fetch upstream (`harness.lock.json` → `upstream`) and replace `core/` with the release tree:
   `git fetch https://github.com/<upstream> <tag> && git checkout FETCH_HEAD -- core`.
3. Only `core/` (and the lockfile if core dependencies changed) in this PR. No module or harness edits; follow-ups go in separate PRs.
4. `pnpm install && pnpm gen && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. New core migrations run through the normal ledger.
5. If modules break because of a core API change, open the upgrade PR as a draft, then fix modules in a follow-up branch on top.
6. PR body: release notes link, migration list, run record. Merges through the single writer queue like any change.
