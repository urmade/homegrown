import de from "../messages/de.json";
import en from "../messages/en.json";

export type ShellCopy = typeof en;

export function shellCopy(locale: string): ShellCopy {
  return locale === "de" ? de : en;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
}
