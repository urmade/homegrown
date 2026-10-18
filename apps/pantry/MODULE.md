# Vorrat (pantry)

Intent: know what the household has at home and what is running low.

- One table, `items`: name, optional unit (null renders as localized "pcs"), quantity, minimum. Names are unique case-insensitively.
- An item is low when `quantity < min_quantity`; `listLowStock` exports that list with the missing amount so other modules (the shopping list) never read `pantry.items` directly.
- Quantity changes are read-then-write in one transaction (`for update`) and clamp at 0.
- Offline: the page is network-first and readable offline; writes are not queued (stock edits need the current value), so the UI says so.
