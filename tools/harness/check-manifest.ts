import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildDataFlow } from "../../core/src/dataflow";
import { loadManifests } from "../../core/src/manifest";
import { done, fail } from "./lib";

/** module.json is valid, matches the code it describes, and every module has its required files. */
let mods: ReturnType<typeof loadManifests> = [];
try {
  mods = loadManifests();
} catch (e) {
  fail((e as Error).message);
}

const { modules } = await import("../../.homegrown/registry.server");
for (const { dir, manifest } of mods) {
  for (const f of ["MODULE.md", "AGENTS.md", "package.json", "src/functions.ts", "migrations"])
    if (!existsSync(join(dir, f))) fail(`apps/${manifest.name}: missing ${f}`);
  const tests = existsSync(join(dir, "tests")) ? readdirSync(join(dir, "tests")).filter((f) => /\.(test|spec)\.tsx?$/.test(f)) : [];
  if (tests.length === 0) fail(`apps/${manifest.name}: needs at least one test in tests/`);

  const code = modules.find((m) => m.manifest.name === manifest.name)?.functions ?? {};
  const declared = new Set(manifest.functions.map((f) => f.name));
  for (const name of Object.keys(code))
    if (typeof code[name] === "object" && code[name] && "handler" in code[name] && !declared.has(name))
      fail(`apps/${manifest.name}: function ${name} is exported from functions.ts but not declared in module.json`);
  for (const name of declared) if (!(name in code)) fail(`apps/${manifest.name}: module.json declares ${name} but functions.ts does not export it`);
}

for (const e of buildDataFlow(mods.map((m) => m.manifest), []).errors.filter((e) => !e.includes("does not exist"))) fail(e);
done("check-manifest");
