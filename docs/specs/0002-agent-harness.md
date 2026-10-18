# 0002 Agent harness

Root AGENTS.md, rules, skills, reviewer, hooks, CI gates and CODEOWNERS (Agent Harness v0.9). Human-reviewed via CODEOWNERS.

## Acceptance criteria

- [core.recorder.select] Undeclared table.column access fails the test suite (recorder throws under NODE_ENV=test).
- [core.pwa.never-cache] check-pwa fails if admin, logs, auth or health responses are cached.

Offline: no new routes.

## Plan

- No new tables, modules or cross-module calls. All checks live in `tools/harness/` so feature PRs cannot weaken them.
- `vitest` runs core and module tests against native Postgres with per-module roles; nothing existing runs tests.
- `@playwright/test` drives the 390/820/1280 screenshots, overflow, installability and offline checks; Lighthouse dropped its PWA category.
- `@axe-core/playwright` provides the axe check the definition of done requires, inside the same Playwright run.
- `eslint`, `@eslint/js` and `typescript-eslint` enforce no console, no raw DB clients in modules and no cross-module imports.
- `knip` fails on new unused files, exports and dependencies, as the test integrity table requires.
- `jscpd` finds duplicate code for the drift report; it only flags, the reviewer decides.
- `prettier` backs the format hook so agent edits stay consistently formatted without a style rule.
