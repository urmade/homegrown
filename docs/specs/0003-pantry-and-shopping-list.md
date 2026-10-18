# 0003 Pantry and shopping list

Two small modules that show cross-module communication through a declared capability: the shopping list pulls low-stock items from the pantry.

## Acceptance criteria

- [pantry.add-item] A member adds a pantry item with unit, stock and minimum.
- [pantry.adjust-quantity] Stock goes up and down and never below zero.
- [pantry.low-stock] The pantry exports the items below their minimum with the missing amount.
- [pantry.validation] Invalid input is rejected.
- [pantry.isolation] The pantry role cannot read other schemas.
- [shopping.add-entry] A member adds an entry to the shopping list.
- [shopping.set-done] Entries can be checked off.
- [shopping.clear-done] Checked-off entries can be removed.
- [shopping.low-stock-import] "Aus Vorrat ergänzen" adds every low pantry item once, via `pantry.listLowStock`.
- [shopping.isolation] The shopping-list role cannot read pantry tables.
- [shopping.e2e-low-stock] End to end in the UI: a low pantry item lands on the shopping list and can be checked off.
- [shopping.offline-replay] An entry added while offline is queued by the service worker and replayed by background sync when the connection is back.

UI copy ships in English (default) and German via `messages/en.json` and `messages/de.json`; units are stored as data and empty units render as the localized "pcs".

Offline: both pages are readable offline (network-first). Shopping-list writes are queued and replayed (last write wins); pantry writes are not queued.

## Plan

- Touched: `apps/pantry`, `apps/shopping-list`, generated CAPABILITIES.md and FEATURES.md. Reuses `@homegrown/ui` and core.
- New module `pantry`: no module tracks household stock yet; it is the source of truth for quantities and minimums.
- New module `shopping-list`: no module holds a shared list; merging it into pantry would mix two intents and two offline policies.
- New table `pantry.items`: one row per supply with quantity and minimum; nothing existing stores stock.
- New table `shopping-list.entries`: one row per list entry; it must not live in the pantry schema because modules own their tables.
- New call `pantry.listLowStock`: the shopping list needs low-stock items and may not read pantry tables, so the pantry exports them.
- `kysely` is needed in each module only for the `Generated` column types of its ctx.db schema interface.
- `zod` declares each function's input and output schemas, which core validates at the boundary.
- `react` renders the module pages and their small client views inside the shared shell.
- `@types/react` is compile-time only for the module views.
