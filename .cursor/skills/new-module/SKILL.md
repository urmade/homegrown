---
name: new-module
description: Scaffold a feature module under apps/<name>. Only after plan review accepted why no existing module fits.
---

# New module

Precondition: the spec plan has a line ``New module `name`: <reason>`` and the reviewer passed it.

## Files

```
apps/<name>/
  package.json        # "@homegrown/mod-<name>", deps: @homegrown/core, @homegrown/ui, kysely (types), zod, react
  module.json         # name = folder; title (de-DE); description; tables; exports; offline; functions
  MODULE.md           # intent, decisions, offline conflict policy if writes queue
  AGENTS.md           # local constraints only, max 60 lines, no loosening of root rules
  migrations/0001_<name>.sql   # unqualified table names; runs as the module role in its own schema
  src/db.ts           # Kysely DB interface keyed "<schema>.<table>" (schema = name with - → _)
  src/functions.ts    # const fn = defineFunctions<DB, Calls>(); export each declared function
  src/page.tsx        # server component, mounted at /<name>; reads via invoke()
  src/view.tsx        # client component; writes via callFn() from @homegrown/core/client
  tests/<name>.test.ts
```

No DESIGN.md unless a deviation exists (`ui-override`).

## module.json

```json
{
  "name": "chores", "title": "Haushaltsplan", "description": "…",
  "tables": ["tasks"],
  "exports": {},
  "offline": { "routes": ["/chores"], "strategy": "network-first", "offlineWrites": "none" },
  "functions": [{ "name": "listTasks", "reads": ["tasks.id", "tasks.title"] }]
}
```

## Then

`pnpm install && pnpm gen` (registry, typed client, service worker), `pnpm migrate`, write tests first, `pnpm gen:docs`.
Tests start with `useModules(modules)` and `resetModule("<name>")` from `@homegrown/core/testing`.
