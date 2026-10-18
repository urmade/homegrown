import { existsSync } from "node:fs";
import { ModuleManifest } from "../../core/src/manifest";
import { addedLines, changedFiles, read, showAtBase } from "./lib";

export type PlanItem = { kind: "dependency" | "module" | "table" | "call"; name: string };

const deps = (json: string | null) => {
  if (!json) return new Set<string>();
  const p = JSON.parse(json) as Record<string, Record<string, string> | undefined>;
  return new Set([...Object.keys(p.dependencies ?? {}), ...Object.keys(p.devDependencies ?? {})]);
};

const calls = (json: string | null) => {
  if (!json) return new Set<string>();
  const m = ModuleManifest.safeParse(JSON.parse(json));
  return new Set(m.success ? m.data.functions.flatMap((f) => f.calls.map((c) => `${m.data.name}.${f.name} -> ${c}`)) : []);
};

/** Everything new in this diff that the plan must justify: dependencies, modules, tables, cross-module calls. */
export function planItems(): PlanItem[] {
  const items: PlanItem[] = [];
  const changes = changedFiles();
  for (const { path } of changes.filter((c) => c.path.endsWith("package.json") && c.status !== "D")) {
    const before = deps(showAtBase(path));
    for (const d of deps(read(path))) if (!before.has(d) && !d.startsWith("@homegrown/")) items.push({ kind: "dependency", name: d });
  }
  for (const { path, status } of changes.filter((c) => /^apps\/[^/]+\/module\.json$/.test(c.path) && c.status !== "D")) {
    const name = path.split("/")[1]!;
    if (status === "A") items.push({ kind: "module", name });
    const before = calls(showAtBase(path));
    if (existsSync(path)) for (const c of calls(read(path))) if (!before.has(c)) items.push({ kind: "call", name: c.split(" -> ")[1]! });
  }
  for (const { path, line } of addedLines(undefined, ["apps/*/migrations/*.sql"])) {
    const m = /create\s+table\s+(if\s+not\s+exists\s+)?("?[a-z_][a-z0-9_]*"?)/i.exec(line);
    if (m) items.push({ kind: "table", name: `${path.split("/")[1]}.${m[2]!.replaceAll('"', "")}` });
  }
  return items.filter((it, i) => items.findIndex((o) => o.kind === it.kind && o.name === it.name) === i);
}
