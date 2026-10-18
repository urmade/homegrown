# shopping-list

- Pantry data only via `ctx.modules.pantry.listLowStock`; never store pantry ids.
- Writes must stay safe to replay (offline queue, last write wins); keep handlers idempotent where cheap.
