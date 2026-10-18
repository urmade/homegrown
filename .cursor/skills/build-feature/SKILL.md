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
## Assumptions
```

`check-plan` fails if a new dependency, module, table or call has no backticked line with a reason. `check-evidence` fails if a criterion has no `[test.id]` or no matching test.

## 2. Plan review

Spawn `.cursor/agents/reviewer.md` with only the spec path: "plan pass". Simplify until PASS. No code before PASS.

## 3. Build (TDD)

Follow `.cursor/skills/vendor-superpowers/test-driven-development/SKILL.md`. Tests are titled with the criterion id:
`it("shopping.low-stock-import adds …")`. Module tests: `apps/<m>/tests/*.test.ts` (vitest, real Postgres). UI flows: `apps/<m>/e2e/*.spec.ts` (Playwright).

- Schema change: `migration-expand-contract`. New module: `new-module`. New cross-module call: `add-capability`.
- Update `module.json` reads/writes/calls with the code; the recorder fails tests on undeclared access.
- UI from `@homegrown/ui`; deviations only via `ui-override`.

## 4. Verify locally

```sh
pnpm gen && pnpm typecheck && pnpm lint && pnpm test
pnpm gen:data-flow && pnpm gen:docs && pnpm build && pnpm e2e
```

Debug with `.cursor/skills/vendor-superpowers/systematic-debugging/SKILL.md`; logs: `/admin/logs?correlationId=…`.

## 5. Diff review

Reviewer "diff pass" with the diff and CI artifact links. Max 2 rounds. Still NEEDS WORK: stop, open an issue with the findings, ping the owner.

## 6. PR

Title states the household outcome. Body: spec link, run record from `artifacts/run-record.json`, evidence links to CI artifacts. Never touch `core/` or harness paths in the same PR. Auto-merge happens on green.
