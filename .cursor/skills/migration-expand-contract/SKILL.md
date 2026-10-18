---
name: migration-expand-contract
description: Any schema change. Additive by default; destructive changes over two deploys with a 7-day grace.
---

# Migrations

Ledger: forward-only, checksummed, one locked runner (`pnpm migrate`). Editing an applied file fails CI and the runner.

## Additive (default)

- New file `apps/<m>/migrations/NNNN_snake_case.sql`, sorting last. Unqualified names; it runs as the module role with `search_path` = module schema.
- New columns nullable or with a default, so the previous release (N-1) still works: CI runs the base branch's tests against the new schema.
- Update `src/db.ts` and the `module.json` reads/writes.

## Destructive (drop, rename, type change)

1. **Expand** (deploy 1): add the new column/table, write both, read the new one. Mark the old column deprecated in MODULE.md with the date.
2. Wait at least 7 days.
3. **Contract** (deploy 2): new migration whose first line is `-- contract: deprecated YYYY-MM-DD` (the expand date) that drops the old part. The deploy agent takes a whole-DB dump before promote; staging rehearses on the latest restored dump.

## Never

Schema-qualified references to other schemas, cross-module foreign keys, `create schema`, roles or grants (core owns those). `check-migrations` fails on each.
