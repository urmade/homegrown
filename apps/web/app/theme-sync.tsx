"use client";

import { useEffect } from "react";
import {
  applyResolvedTheme,
  parseThemePref,
  readStoredThemePref,
  resolveTheme,
  systemPrefersDark,
  THEME_EVENT,
  THEME_KEY,
  writeStoredThemePref,
} from "@homegrown/ui";

export function ThemeSync() {
  useEffect(() => {
    const apply = () => applyResolvedTheme(resolveTheme(readStoredThemePref(), systemPrefersDark()));
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readStoredThemePref() === "system") apply();
    };
    mq.addEventListener("change", onScheme);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) apply();
    };
    const onTheme = () => apply();
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onTheme);
    return () => {
      mq.removeEventListener("change", onScheme);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);
  return null;
}

export function setThemePref(pref: "system" | "light" | "dark") {
  const parsed = parseThemePref(pref);
  writeStoredThemePref(parsed);
  applyResolvedTheme(resolveTheme(parsed, systemPrefersDark()));
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: parsed }));
}

export function nextThemePref(pref: "system" | "light" | "dark"): "system" | "light" | "dark" {
  return pref === "system" ? "light" : pref === "light" ? "dark" : "system";
}
