/** Client-safe i18n primitives. Catalogs are flat key → string maps with {var} placeholders; en is the fallback. */
export type Messages = Record<string, string>;
export type Catalogs = Record<string, Messages>;
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const DEFAULT_LOCALE = "en";

export function translator(messages: Messages): Translate {
  return (key, vars) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (m, k: string) => (vars && k in vars ? String(vars[k]) : m));
}

/** en first, then the requested locale on top, so a missing translation shows English instead of a key. */
export const messagesFor = (catalogs: Catalogs, locale: string): Messages => ({ ...catalogs[DEFAULT_LOCALE], ...catalogs[locale] });
