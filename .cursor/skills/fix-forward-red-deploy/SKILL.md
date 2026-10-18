---
name: fix-forward-red-deploy
description: A deploy went red and was rolled back. Revert the merge on main, read the error logs for the SHA from the PR comment, fix on a branch. Max 3 attempts.
---

# Fix forward after a red deploy

The deploy agent already rolled prod back to the previous image and commented on the PR with the error logs for the SHA. Prod schema stays (N-1 makes that safe).

1. **Revert first.** The deploy agent already pushed `revert/<sha>` and opened its PR: it reverts everything merged since the last good deploy (`prev..sha`, migrations kept) and merges through the normal gate, so main matches prod again. The agent retries the push until the branch exists. Innocent PRs in that range must be re-landed after the fix.
2. **Evidence.** Read the PR comment ("Error logs for this SHA"). For more: `/admin/logs?sha=<sha>&level=error`, then follow one `correlationId`.
3. **Reproduce** in a failing test titled with the original criterion id or a new `[module.regression-…]` criterion added to the spec. Use `.cursor/skills/vendor-superpowers/systematic-debugging/SKILL.md`.
4. **Fix** on a branch through `build-feature` (plan pass can be short: what broke, why the fix is minimal).
5. Attempt counter lives in the run record. After the 3rd red attempt: stop, open an issue with the three run records, ping the owner.

Never re-land the reverted change unchanged, and never edit applied migrations to fix it.
