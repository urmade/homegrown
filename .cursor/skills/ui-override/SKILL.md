---
name: ui-override
description: A module needs a local UI deviation (inline style, raw color, arbitrary Tailwind value, other UI kit) or a responsive exception. Records it in DESIGN.md; auto-merges on green.
---

# UI override

First ask: should this be a design-system change instead? New reusable patterns go into `packages/ui` (tokens in `tokens.css`, components in `index.tsx`), not into a module.

If it is truly local:

1. Create `apps/<m>/DESIGN.md` (only now; it exists only when a deviation exists).
2. One entry per deviation, naming the file so `check-design` can match it:

```md
## Deviations
- src/board.tsx: arbitrary grid `grid-cols-[repeat(7,minmax(0,1fr))]` for the week view; no token fits a 7-column calendar.

## Responsive exceptions
- responsive-exception: /chores/print — printable A4 sheet, requested explicitly by the household.
```

3. Responsive exceptions only when the user explicitly asked; `check-responsive` skips the overflow check for listed routes, screenshots still run.
4. When the deviation is removed, remove its entry; delete DESIGN.md when empty.
