# Einkaufsliste (shopping-list)

Intent: one shared list the household shops from, filled by hand or from the pantry.

- One table, `entries`: title, quantity, unit, done, source (`manual` or `pantry`), `added_by` (core member id).
- `addLowStock` calls the declared capability `pantry.listLowStock` and inserts every low item not already open on the list (matched by title, case-insensitive). It stores no pantry ids: modules reference each other only by core member ids.
- Offline: the page is network-first; writes are queued by the service worker and replayed by background sync.
- Offline conflict policy: last write wins. A queued "done" toggle replays as-is; a queued add may duplicate an entry someone else added meanwhile, which is acceptable for a shopping list.
