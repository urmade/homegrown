---
name: build-feature
description: Use for every household intake request. Spec with offline answer, plan with reasons, plan review, TDD build, verify, data-flow check, diff review, PR.
---

# Build a feature

One run, one writer to main. Abort rather than ship with open findings.

## 0. Start

- Read the last 20 run records from recent PRs (PR body "Run record" section). If the signature you are about to hit has repeated 3 times, use `propose-harness-change` instead of retrying.
- Read `CAPABILITIES.md` and `FEATURES.md`. Prefer extending an existing module or capability.

## 1. Spec — `docs/specs/<NNNN>-<slug>.md`

```md
# NNNN Title
## Acceptance criteria
- [module.behaviour] One observable behaviour per line. UI criteria name empty, loading and error states.
Offline: what works offline; do writes queue (last write wins) or not.
## Plan
- Touched modules, tables, reused capabilities.
- New `thing`: why nothing existing works (one line each, the name in backticks).
- Failure modes of <end-to-end flow touched>:
  - <how it can fail>: <how this change handles it, or why it is out of scope>
## Assumptions
```

Fix the flow, not the symptom: walk the whole flow (input, empty, error, offline, permissions, cross-module calls), list every failure mode, and address them in this one change. `check-plan` fails if a changed spec lists fewer than two failure modes, or if a new dependency, module, table or call has no backticked line with a reason. `check-evidence` fails if a criterion has no `[test.id]` or no matching test.

## 2. Plan review

Spawn `.cursor/agents/reviewer.md` with only the spec path: "plan pass". Simplify until PASS. No code before PASS.

## 3. Build (TDD)

Follow `.cursor/skills/vendor-superpowers/test-driven-development/SKILL.md`. Tests are titled with the criterion id:
`it("shopping.low-stock-import adds …")`. Module tests: `apps/<m>/tests/*.test.ts` (vitest, real Postgres). UI flows: `apps/<m>/e2e/*.spec.ts` (Playwright).

- Schema change: `migration-expand-contract`. New module: `new-module`. New cross-module call: `add-capability`.
- Update `module.json` reads/writes/calls with the code; the recorder fails tests on undeclared access.
- UI from `@homegrown/ui`; deviations only via `ui-override`.
- No literal UI text: add keys to `messages/en.json` and `messages/de.json`, render with `t("key")`. E2e tests assert on English copy.

## 4. Verify locally

```sh
pnpm gen && pnpm typecheck && pnpm lint && pnpm test && pnpm exec tsx tools/harness/check-i18n.ts
pnpm gen:data-flow && pnpm gen:docs && pnpm build && pnpm e2e
```

Debug with `.cursor/skills/vendor-superpowers/systematic-debugging/SKILL.md`; logs: `/admin/logs?correlationId=…`.

## 5. Diff review

Reviewer "diff pass" with the diff and CI artifact links. Max 2 rounds. Still NEEDS WORK: stop, open an issue with the findings, ping the owner.

## 6. PR

Title states the household outcome. Body: spec link, run record from `artifacts/run-record.json`, evidence links to CI artifacts. Never touch `core/` or harness paths in the same PR. Mark it ready (not draft); the auto-merge bot merges it once the latest `ci` run is green and the branch contains current `main` (it updates the branch and re-runs CI itself; failed jobs are retried once). If it comments that the branch can't be updated, merge `main` in and push.
