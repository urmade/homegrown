# 0006 Toast and banner follow dark tokens

Port of the shared dark-mode toast/banner bits from [urmade/homegrown-home#35](https://github.com/urmade/homegrown-home/pull/35). Calendar-only work stays in `homegrown-home`. This repo has no `Toast` export and no calendar; the SW “new version available” toast and `Banner`/`Notice` are the two surfaces.

## Acceptance criteria

- [ux.toast-theme] One token rule in `packages/ui/src/tokens.css` lists `.hg-toast, .hg-sw-toast` and sets `--hg-surface-raised`, `--hg-text`, `--hg-border`, `--hg-shadow-2`, and `z-index: var(--hg-z-toast)`. `.hg-banner` uses `--hg-surface-sunken` / `--hg-text-muted`; `.hg-banner[data-tone="danger"]` uses the danger mix (not `bg-danger/10`). `SwRegister` markup is `hg-sw-toast hg-toast` and does not contain `bg-surface`, `shadow-lg`, or `border-border`. `Banner`/`Notice` markup is `hg-banner` plus `data-tone` and does not contain `bg-surface-sunken` or `bg-danger/10`. With `html[data-theme=dark]`, probes of `.hg-toast`, `.hg-sw-toast`, `.hg-banner`, and `.hg-banner[data-tone=danger]` have a computed background that is not `#ffffff` / `rgb(255, 255, 255)` and not transparent; toast/banner default foreground is not light-theme `--hg-text` (`#111827` / `rgb(17, 24, 39)`). Empty: SW toast is hidden until a worker is waiting; Banner is the message (neutral) or the error (danger). Loading: n/a.

Offline: the SW toast is online-only (a waiting worker). Banner/Notice stay as today (no new writes). Theme tokens apply offline once CSS is cached.

## Plan

- Touched: `packages/ui` (`tokens.css` append only, `Banner`/`Notice` class, `theme.test.ts`), `apps/web` (`sw-register.tsx`, `globals.css`, e2e). No new module, table, dependency, or cross-module call. Calendar paths are not edited.
- No `Toast` export: this repo has no caller (knip). `.hg-toast` is the same CSS rule as `.hg-sw-toast` (household #35 + matching `theme.test.ts` assertions), not a second paint path.
- Designer hex in `tokens.css` stays as committed — append the toast/banner rules only; do not reformat that file (prettier lowercases hex and breaks `ux.theme.tokens`).
- Failure modes of seeing the SW update toast or a Banner/Notice after a dark theme resolve:
  - `bg-surface` / `shadow-lg` stay white in dark: the token rule paints `.hg-toast` / `.hg-sw-toast`; `SwRegister` drops those utilities (`ux.toast-theme`).
  - An injected class probe passes while `sw-register.tsx` still has `bg-surface` / `shadow-lg` (`NODE_ENV !== "production"` never mounts it): the same test reads the source (or the className) and forbids those utilities (`ux.toast-theme`).
  - `Banner` `bg-surface-sunken` drops out of the compiled sheet: `.hg-banner` lives in `tokens.css` (`ux.toast-theme`).
  - Danger `Banner`/`Notice` (pantry error, shopping retry, admin data-flow) stays `bg-danger/10` or light: `[data-tone=danger]` uses the danger mix; the dark probe includes that selector (`ux.toast-theme`).
  - Toast sits under the tab bar or dialog: `z-index: var(--hg-z-toast)` on the token rule and on `.hg-sw-toast` (`ux.toast-theme`).
  - Prettier rewrites designer hex and `ux.theme.tokens` fails: do not format `tokens.css` (`ux.theme.tokens`).
  - A calendar-only e2e never runs here: `theme.test.ts` plus `apps/web` e2e probe the classes in dark (`ux.toast-theme`).

## Assumptions

- This repo has no calendar and no shared `Toast` export. Shopping-list notices stay `Notice`.
- `Banner` stays `neutral | danger` only (no unused `warning` / `action` options).
