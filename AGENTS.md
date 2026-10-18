# Homegrown

Self-hosted household PWA on a home NAS (Docker, Postgres, single tenant). Agents build features; CI, branch
protection and the database enforce the rules. No human reads feature PRs. Simple, strict, rollback-able.

This file is a map. Anything checkable is a CI gate; when prose and a check disagree, the check wins.

## Precedence

1. CI + branch protection: the only real gate. Nothing merges red.
2. Hooks (`.cursor/hooks.json`): fast feedback, bypassable, so CI repeats every check.
3. Rules (`.cursor/rules/`): one line each, naming the check that enforces it.
4. This file.
5. `apps/<module>/AGENTS.md`: add-only local constraints, max 60 lines.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | The one Next.js shell: navigation, admin pages (`/admin`, `/admin/logs`, `/admin/data-flow`) |
| `apps/<module>` | Feature module: `module.json`, `messages/{en,de}.json`, `MODULE.md`, `AGENTS.md`, `migrations/`, `src/functions.ts`, `src/page.tsx`, `tests/`, `e2e/` |
| `core/` | Vendored `@homegrown/core`, read-only (CI). ctx.db, ctx.log, auth, i18n, registry, migrations, PWA, data-flow |
| `packages/ui` | `@homegrown/ui`: tokens and components, responsive by default |
| `packages/deploy-agent` | NAS-side pull deploys; the only holder of prod credentials |
| `tools/harness/` | Every CI check, lint/test/e2e config |
| `docs/specs/<id>.md` | Per-run spec: acceptance criteria with test ids, offline answer, plan with reasons |
| `CAPABILITIES.md`, `FEATURES.md` | Generated from module.json (`pnpm gen:docs`); read before planning |

## Module contract (short)

- `module.json` declares tables, exports, offline behaviour, and per function `reads`/`writes` (`table.column`) and `calls` (`module.capability`).
- One Postgres schema and role per module. Cross-schema access fails in the database.
- Functions: `const fn = defineFunctions<DB, Calls>()`; handlers get `ctx.db`, `ctx.log`, `ctx.auth`, `ctx.modules`.
- Cross-module calls only via `ctx.modules.<module>.<capability>`; the generated client only exposes declared calls.
- Identity: `ctx.auth.currentMember()`. Other data is referenced only by core member ids.
- UI text: `const t = await getT("<module>")` in pages, `translator(messages)` in client views (messages passed as a prop).
  Locale = member override, else household default (asked on first setup), else English.

## Commands

```sh
pnpm install && pnpm gen          # registry, typed clients, service worker
pnpm migrate                      # needs MIGRATE_DATABASE_URL (owner) and APP_DB_PASSWORD
pnpm dev                          # needs DATABASE_URL (app role)
pnpm test                         # vitest against native Postgres, per-module roles
pnpm build && pnpm e2e            # screenshots 390/820/1280, overflow, axe, PWA, offline
pnpm lint && pnpm typecheck
pnpm gen:docs                     # CAPABILITIES.md, FEATURES.md
pnpm gen:data-flow                # .homegrown/data-flow.json (after migrate)
```

Agent VM setup: `.cursor/environment.json` (Node, pnpm, native Postgres, Playwright, test-only credentials).

## Skill routing

| When | Skill |
| --- | --- |
| Any intake request | `build-feature` (always start here) |
| New module, after plan review accepted the reason | `new-module` |
| Export or consume a cross-module function | `add-capability` |
| Any schema change | `migration-expand-contract` |
| UI deviation or responsive exception | `ui-override` |
| Red deploy reverted; error logs on the PR | `fix-forward-red-deploy` |
| Upstream core release | `upgrade-core` |
| Weekly scheduled run | `cleanup` |
| A failure signature repeated 3 times | `propose-harness-change` |

Vendored at a pinned SHA (`harness.lock.json`): `.cursor/skills/vendor-superpowers/test-driven-development`,
`.cursor/skills/vendor-superpowers/systematic-debugging`.

## Definition of done

1. Plan with reasons for every new table, module, dependency or cross-module call, and a failure-mode list for the
   end-to-end flow touched (fix the flow, not the symptom); passed by plan review before build.
2. Every acceptance criterion `- [test.id] …` maps to a test titled `test.id …` (check-evidence).
3. UI: empty, loading and error states; screenshots at 390, 820, 1280; no horizontal overflow; axe clean.
4. PWA installable; every declared offline route passes with the network off.
5. check-data-flow green; `/admin/data-flow` reflects the change.
6. No `console.*`; errors go through `ctx.log` with a correlation id.
7. Every UI string is a catalog key present in `en` (and translated in `de`); check-i18n green.
8. Diff review PASS within 2 rounds, else abort, open an issue, ping the owner.
9. All CI gates green; evidence links point at CI artifacts, never at claims.

## Fail closed

When in doubt, stop and report. Never skip, weaken or delete a test to get green. Never edit `core/` or harness
paths in a feature PR (CI rejects harness + `apps/` together). Max 2 review rounds, max 3 fix-forward attempts.

## Run records

The stop hook writes a run record (outcome, stage, failure signature, one-line fix, paths) to
`artifacts/run-record.json`; put it in the PR body. Never commit run records.

## Reviewer

`.cursor/agents/reviewer.md`: fresh context, read-only, two passes (plan, then diff). The builder never grades its own work.

## Copy and data

English is the default language; every module ships `messages/en.json` and `messages/de.json`. Code, docs and
commits English. No real household data or secrets anywhere, including PR bodies.
