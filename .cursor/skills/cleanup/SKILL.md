---
name: cleanup
description: Weekly scheduled run from the intake bot. Find dead code, unused capabilities and overlapping modules; open removal PRs that auto-merge on green.
---

# Weekly cleanup

1. **Dead code**: `pnpm knip` (config `tools/harness/knip.json`). Remove unused files, exports and dependencies.
2. **Unused capabilities**: `CAPABILITIES.md` entries marked "Unused." and `pnpm gen:data-flow` calls. Unexport, or remove the function if nothing in-module uses it.
3. **Unused declarations**: check-data-flow warnings ("declares … but no test exercised it") — either add the missing test or drop the declaration.
4. **Overlapping modules**: compare `FEATURES.md` descriptions and tables. Merging modules is a feature run (`build-feature`) with a spec, not a cleanup PR.

Rules:

- One concern per PR, each with a short spec (criteria: existing tests still pass; plan: what goes and why it is unused).
- Removing tables or columns follows `migration-expand-contract` (7-day grace). Deprecate this week, drop in a later run.
- Never remove a test that still covers live behaviour.
