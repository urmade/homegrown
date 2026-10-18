---
name: fix-forward-red-deploy
description: A deploy went red and was rolled back. Revert the merge on main, read the error logs for the SHA from the PR comment, fix on a branch. Max 3 attempts.
---

# Fix forward after a red deploy

The deploy agent already rolled prod back to the previous image and commented on the PR with the error logs for the SHA. Prod schema stays (N-1 makes that safe).

1. **Revert first.** Open a revert PR of the merge commit on main. It auto-merges on green, so main matches prod again.
2. **Evidence.** Read the PR comment ("Error logs for this SHA"). For more: `/admin/logs?sha=<sha>&level=error`, then follow one `correlationId`.
3. **Reproduce** in a failing test titled with the original criterion id or a new `[module.regression-…]` criterion added to the spec. Use `.cursor/skills/vendor-superpowers/systematic-debugging/SKILL.md`.
4. **Fix** on a branch through `build-feature` (plan pass: what broke, every other way the same flow can fail, how this one fix covers them).
5. Attempt counter lives in the run record. After the 3rd red attempt: stop, open an issue with the three run records, ping the owner.

Never re-land the reverted change unchanged, and never edit applied migrations to fix it.
