import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

const ident = /^[a-z][a-z0-9_]*$/;
const column = z.string().regex(/^[a-z][a-z0-9_]*\.([a-z][a-z0-9_]*|\*)$/, "expected table.column");
const call = z.string().regex(/^[a-z][a-z0-9-]*\.[a-zA-Z][a-zA-Z0-9]*$/, "expected module.capability");

export const ModuleManifest = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    tables: z.array(z.string().regex(ident)),
    exports: z.record(z.string(), z.string().min(1)).default({}),
    offline: z
      .object({
        routes: z.array(z.string().startsWith("/")).default([]),
        data: z.array(z.string().startsWith("/")).default([]),
        strategy: z.enum(["network-first", "cache-first", "stale-while-revalidate"]).default("network-first"),
        offlineWrites: z.enum(["queue", "none"]).default("none"),
      })
      .optional(),
    functions: z.array(
      z.strictObject({
        name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
        reads: z.array(column).default([]),
        writes: z.array(column).default([]),
        calls: z.array(call).default([]),
      }),
    ),
  })
  .strict();

export type ModuleManifest = z.infer<typeof ModuleManifest>;
export type FunctionDecl = ModuleManifest["functions"][number];

export const schemaOf = (module: string) => module.replaceAll("-", "_");
export const roleOf = (module: string) => `hg_mod_${schemaOf(module)}`;

export function repoRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = resolve(dir, "..");
    if (up === dir) throw new Error("repo root not found");
    dir = up;
  }
  return dir;
}

/** Feature modules are apps/* with a module.json; apps/web is the shell. */
export function loadManifests(root = repoRoot()): { dir: string; manifest: ModuleManifest }[] {
  const apps = join(root, "apps");
  return readdirSync(apps)
    .filter((d) => existsSync(join(apps, d, "module.json")))
    .sort()
    .map((d) => {
      const file = join(apps, d, "module.json");
      const parsed = ModuleManifest.safeParse(JSON.parse(readFileSync(file, "utf8")));
      if (!parsed.success) throw new Error(`${file}: ${z.prettifyError(parsed.error)}`);
      if (parsed.data.name !== d) throw new Error(`${file}: name must equal folder name "${d}"`);
      return { dir: join(apps, d), manifest: parsed.data };
    });
}
