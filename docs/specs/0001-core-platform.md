# 0001 Core platform

Empty household app plus the core every module builds on (Architecture v0.12).

## Acceptance criteria

- [core.recorder.select] ctx.db records which table.column each function reads.
- [core.recorder.write] ctx.db records written columns for insert, update and delete.
- [core.log.redact] Logs never contain secrets, payloads or personal data, for every sink.
- [core.data-flow.errors] The data-flow generator fails on declared columns, tables or calls that do not exist.
- [core.data-flow.calls] data-flow.json lists every module-to-module call.
- [core.pwa.never-cache] The service worker never caches admin, auth or health responses.
- [core.i18n.translate] UI strings come from catalogs with {var} placeholders; a missing translation falls back to English, then to the key.
- [core.i18n.catalogs] Core ships en and de catalogs with the same keys; English is the default.
- [deploy.promote-green] A green prod smoke records the deploy and the deployed SHA.
- [deploy.rollback-after-promote] A red prod smoke after promotion restores the previous image, pushes a revert of the merge to a revert branch (PR via GitHub when configured) and reports the SHA's error logs.

Offline: the shell (`/_next/static`, icons, `/offline`) is cached; undeclared routes show the offline notice.

## Plan

- New code lives in `core/` (vendored, read-only downstream), `packages/ui`, `packages/deploy-agent`, `apps/web`. No modules.
- `kysely` is the ctx.db query builder: its operation tree lets the recorder see exact table.column access, which raw SQL parsing cannot.
- `pg` is the Postgres driver under Kysely, the log sink and the migration runner; one driver for all three.
- `zod` validates module.json and every function's input and output at the module boundary, as the contract requires.
- `workbox-build` composes all module offline declarations into the one service worker at build time without coupling to the Next bundler.
- `next`, `react`, `react-dom` are the single app shell the architecture prescribes.
- `tailwindcss` and `@tailwindcss/postcss` map the design tokens to utility classes, as the UI section prescribes.
- `tsx` runs the TypeScript migration runner, generators and the deploy agent without a separate build step.
- `typescript`, `@types/node`, `@types/pg`, `@types/react`, `@types/react-dom` are compile-time types only.
- i18n lives in core (`core/src/i18n.ts`, `core/messages/<locale>.json`); modules ship `messages/<locale>.json` next to `module.json`. Locale = member override, else household default (asked on first setup, stored in new table `core.settings`), else English. No i18n library: flat catalogs and one `translator()` cover it.
- `vitest` in `core` and `packages/deploy-agent` runs their unit tests in this PR's bootstrap CI before the harness lands.
- `@homegrown/deploy-agent` runs on the NAS only; it is the single holder of prod database and GitHub write credentials.
