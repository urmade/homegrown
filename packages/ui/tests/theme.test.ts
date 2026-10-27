import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseThemePref, resolveTheme, THEME_BOOT_SCRIPT } from "../src/theme";

const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");

it("ux.theme.tokens light and dark variables match the designer table and drop beige", () => {
  expect(css).toContain("--hg-bg: #F6F7F9");
  expect(css).toContain("--hg-surface: #FFFFFF");
  expect(css).toContain("--hg-surface-raised: #FFFFFF");
  expect(css).toContain("--hg-surface-sunken: #EEF1F4");
  expect(css).toContain("--hg-border: #DDE1E7");
  expect(css).toContain("--hg-border-strong: #7B8494");
  expect(css).toContain("--hg-text: #111827");
  expect(css).toContain("--hg-text-muted: #4B5563");
  expect(css).toContain("--hg-text-subtle: #6B7280");
  expect(css).toContain("--hg-primary: #1F5AE0");
  expect(css).toContain("--hg-on-primary: #FFFFFF");
  expect(css).toContain("--hg-primary-soft: #E8EFFD");
  expect(css).toContain("--hg-danger: #C81E1E");
  expect(css).toContain("--hg-on-danger: #FFFFFF");
  expect(css).toContain("--hg-success: #15803D");
  expect(css).toContain("--hg-warning: #B45309");
  expect(css).toContain("--hg-focus: #1F5AE0");
  expect(css).toContain('[data-theme="dark"]');
  expect(css).toContain("--hg-bg: #0E1116");
  expect(css).toContain("--hg-primary: #7AA7FF");
  expect(css).toContain("--color-fg: var(--hg-text)");
  expect(css).toContain("--color-accent: var(--hg-primary)");
  expect(css).toContain("--color-surface-muted: var(--hg-surface-sunken)");
  expect(css).not.toMatch(/#f7f6f1/i);
  expect(css).not.toMatch(/#efede5/i);
  expect(css).not.toMatch(/#3f7d4e/i);
  expect(css).not.toMatch(/--hg-now/);
  expect(css).not.toMatch(/--ev-blue-/);
  expect(css).not.toMatch(/@media\s*\(\s*prefers-color-scheme/);
});

it("ux.toast-theme Toast SW toast and Banner use raised surface tokens", () => {
  expect(css).toMatch(/\.hg-toast[\s\S]*--hg-surface-raised/);
  expect(css).toMatch(/\.hg-sw-toast[\s\S]*--hg-surface-raised/);
  expect(css).toMatch(/\.hg-banner[\s\S]*--hg-/);
  expect(css).toMatch(/\.hg-banner\[data-tone="danger"\][\s\S]*--hg-danger/);
  expect(css).not.toContain("shadow-lg");
  const sw = readFileSync(new URL("../../../apps/web/app/sw-register.tsx", import.meta.url), "utf8");
  expect(sw).toContain("hg-sw-toast");
  expect(sw).toContain("hg-toast");
  expect(sw).not.toContain("shadow-lg");
  expect(sw).not.toMatch(/bg-surface(?!-)/);
});

it("ux.theme.resolver system light/dark and garbage fall back to system", () => {
  expect(parseThemePref(null)).toBe("system");
  expect(parseThemePref("nope")).toBe("system");
  expect(parseThemePref("light")).toBe("light");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
  expect(THEME_BOOT_SCRIPT).toContain("theme-color");
  expect(THEME_BOOT_SCRIPT).toContain("#161A21");
  expect(THEME_BOOT_SCRIPT).not.toContain("prefers-color-scheme: light");
});
