---
name: propose-harness-change
description: A failure signature has repeated 3 times in recent run records. Open a harness PR for owner review that fixes it at the highest level.
---

# Propose a harness change

Trigger: the same signature (failing check name + stage) appears 3 times in the last 20 run records, or the same module-level fix appears in 2+ modules (promote it to root).

1. Collect the run records and PR links.
2. Choose the highest level that prevents it, in this order: a check or type (`tools/harness/`, core types upstream), a test, then rule text (`.cursor/rules/`, one line, naming its check), then AGENTS.md routing.
3. Branch `harness/<signature>`. Touch only harness paths (`AGENTS.md`, `.cursor/rules|skills|agents|hooks*`, `.github/`, `tools/harness/`, `harness.lock.json`). CI fails mixed PRs with `apps/`.
4. PR body: the repeated signature, linked runs, the change, and how it would have caught each run.
5. Leave it for the technical owner (CODEOWNERS review). Do not enable auto-merge; do not retry the failing feature until it lands or is rejected.
