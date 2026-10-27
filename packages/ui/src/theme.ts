export const THEME_KEY = "hg-theme";
export const THEME_COLOR_LIGHT = "#FFFFFF";
export const THEME_COLOR_DARK = "#161A21";
export const THEME_EVENT = "hg-theme";

export type ThemePref = "system" | "light" | "dark";
export type ThemeResolved = "light" | "dark";

export function parseThemePref(raw: string | null | undefined): ThemePref {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): ThemeResolved {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

export function readStoredThemePref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function writeStoredThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode */
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function applyResolvedTheme(resolved: ThemeResolved) {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  const color = resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
  } else {
    metas.forEach((m) => m.setAttribute("content", color));
  }
}

/** Inline <head> script: resolve system/light/dark before first paint. */
export const THEME_BOOT_SCRIPT = `(function(){var resolved="light";try{var raw=null;try{raw=localStorage.getItem("hg-theme")}catch(e){}var pref=raw==="light"||raw==="dark"||raw==="system"?raw:"system";var systemDark=false;try{systemDark=matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}resolved=pref==="dark"||(pref!=="light"&&systemDark)?"dark":"light"}catch(e){}try{var r=document.documentElement;r.setAttribute("data-theme",resolved);r.style.colorScheme=resolved;var color=resolved==="dark"?"#161A21":"#FFFFFF";var metas=document.querySelectorAll('meta[name="theme-color"]');if(!metas.length){var m=document.createElement("meta");m.setAttribute("name","theme-color");m.setAttribute("content",color);document.head.appendChild(m)}else{metas.forEach(function(m){m.setAttribute("content",color)})}}catch(e){}})();`;
