---
name: add-capability
description: Export a function for other modules or consume another module's capability. Use whenever one module needs another module's data or behaviour.
---

# Add a capability

Modules never read each other's tables. They call declared, Zod-validated functions that run in the caller's transaction under the callee's DB role.

## Export (provider module)

1. Check `CAPABILITIES.md`: reuse or extend an existing capability before adding one.
2. Add the function to `src/functions.ts` and `module.json` `functions`, with exact reads/writes.
3. Add it to `module.json` `exports` with a one-line description: `"listLowStock": "Items below their minimum …"`.
4. Output schema is a contract: later changes are additive only.

## Consume (caller module)

1. Spec plan line: ``New call `provider.capability`: <why>``.
2. Add `"calls": ["provider.capability"]` to the calling function in `module.json`.
3. `pnpm gen` regenerates `apps/<caller>/.generated/client.ts`; then `await ctx.modules.provider.capability(input)`.
   Undeclared calls do not exist on the type (tsc fails) and throw at runtime.
4. Never store the provider's ids; reference shared things by core member id or by value.

## Verify

- Caller test exercises the call with real provider data (register both modules with `useModules(modules)`).
- `pnpm gen:docs` updates CAPABILITIES.md ("Used by"); the PR drift comment shows the new connection.
- `/admin/data-flow` shows the edge.
