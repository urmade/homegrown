import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { loadManifests } from "../../core/src/manifest";
import { done, fail, read, warn } from "./lib";

/**
 * Every UI string comes from a catalog, and every key used or translated exists in en (the default).
 * Areas: core (core/messages, used by apps/web) and each module (apps/<m>/messages, used by apps/<m>/src).
 * packages/ui has no catalog, so it may not contain UI text at all.
 */
const USER_ATTRS = new Set(["title", "description", "label", "placeholder", "alt", "aria-label", "aria-description", "message", "action"]);
const USER_PROPS = new Set(["text", "title", "label", "description", "message", "placeholder"]);
const LETTER = /\p{L}/u;

const walk = (d: string): string[] =>
  existsSync(d)
    ? readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        if (f === "node_modules" || f.startsWith(".")) return [];
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) ? [p] : [];
      })
    : [];

type Area = { name: string; catalogDir: string | null; sources: string[] };
const areas: Area[] = [
  { name: "core", catalogDir: "core/messages", sources: [...walk("apps/web/app"), ...walk("apps/web/lib")] },
  { name: "packages/ui", catalogDir: null, sources: walk("packages/ui/src") },
  ...loadManifests().map((m) => ({ name: m.manifest.name, catalogDir: join(m.dir, "messages"), sources: walk(join(m.dir, "src")) })),
];

function literalText(n: ts.Node): string | null {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ");
  return null;
}

/** String literals rendered to the user inside a JSX expression; call arguments and comparisons are code, not copy. */
function renderedStrings(n: ts.Node, out: ts.Node[] = []): ts.Node[] {
  const text = literalText(n);
  if (text !== null) {
    if (LETTER.test(text)) out.push(n);
    return out;
  }
  if (ts.isCallExpression(n) || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return out;
  if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.InKeyword].includes(n.operatorToken.kind))
    return out;
  if (ts.isElementAccessExpression(n) || ts.isPropertyAccessExpression(n)) return out;
  n.forEachChild((c) => void renderedStrings(c, out));
  return out;
}

/** t("key"), t(cond ? "a" : "b") and t(`prefix.${x}`) (prefix match). */
function usedKeys(arg: ts.Expression): { key: string; prefix: boolean }[] {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return [{ key: arg.text, prefix: false }];
  if (ts.isConditionalExpression(arg)) return [...usedKeys(arg.whenTrue), ...usedKeys(arg.whenFalse)];
  if (ts.isTemplateExpression(arg)) return [{ key: arg.head.text, prefix: true }];
  return [];
}

for (const area of areas) {
  let en: Record<string, string> = {};
  if (area.catalogDir) {
    const enFile = join(area.catalogDir, "en.json");
    if (!existsSync(enFile)) {
      if (area.sources.some((f) => f.endsWith(".tsx"))) fail(`${area.name}: UI without ${enFile}`);
    } else {
      en = JSON.parse(read(enFile));
      for (const f of readdirSync(area.catalogDir).filter((x) => x.endsWith(".json") && x !== "en.json")) {
        const other = JSON.parse(read(join(area.catalogDir, f))) as Record<string, string>;
        for (const k of Object.keys(other)) if (!(k in en)) fail(`${area.catalogDir}/${f}: key "${k}" does not exist in en.json`);
        for (const k of Object.keys(en)) if (!(k in other)) warn(`${area.catalogDir}/${f}: missing "${k}" (falls back to English)`);
      }
      if (area.name !== "core" && !("title" in en)) fail(`${enFile}: needs a "title" key (navigation label)`);
    }
  }

  const used = new Set<string>();
  for (const file of area.sources) {
    const src = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const at = (n: ts.Node) => `${file}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
    const hardcoded = (n: ts.Node, what: string) => fail(`${at(n)}: hard-coded UI text ${what}; put it in ${area.catalogDir ?? "the caller's catalog (pass it as a prop)"}`);

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "t" && n.arguments[0]) {
        for (const { key, prefix } of usedKeys(n.arguments[0])) {
          used.add(key);
          const ok = prefix ? Object.keys(en).some((k) => k.startsWith(key)) : key in en;
          if (!ok) fail(`${at(n)}: t("${key}${prefix ? "…" : ""}") is not in ${area.catalogDir ?? "a catalog"}/en.json`);
        }
      }
      if (ts.isJsxText(n) && LETTER.test(n.text)) hardcoded(n, `"${n.text.trim()}"`);
      if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent)) for (const s of renderedStrings(n.expression)) hardcoded(s, s.getText());
      if (ts.isJsxAttribute(n) && USER_ATTRS.has(n.name.getText()) && n.initializer) {
        const init = n.initializer;
        if (ts.isStringLiteral(init) && LETTER.test(init.text)) hardcoded(init, `in ${n.name.getText()}="${init.text}"`);
        if (ts.isJsxExpression(init) && init.expression) for (const s of renderedStrings(init.expression)) hardcoded(s, `in ${n.name.getText()}`);
      }
      if (file.endsWith(".tsx") && ts.isPropertyAssignment(n) && USER_PROPS.has(n.name.getText())) {
        const text = literalText(n.initializer);
        if (text && LETTER.test(text) && /\s/.test(text.trim())) hardcoded(n.initializer, `in ${n.name.getText()}:`);
      }
      n.forEachChild(visit);
    };
    visit(src);
  }
  for (const k of Object.keys(en)) if (area.name !== "core" && k !== "title" && ![...used].some((u) => k === u || k.startsWith(u))) warn(`${area.catalogDir}/en.json: "${k}" is unused`);
}
done("check-i18n");
