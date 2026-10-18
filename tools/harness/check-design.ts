import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { loadManifests } from "../../core/src/manifest";
import { done, fail, read, warn } from "./lib";

/**
 * Local UI deviations (inline styles, raw colors, arbitrary Tailwind values, other UI kits) are allowed
 * only when the module's DESIGN.md lists the file. DESIGN.md exists only when a deviation does.
 */
const DEVIATIONS: [RegExp, string][] = [
  [/style=\{\{/, "inline style"],
  [/#[0-9a-fA-F]{3,8}\b/, "raw color"],
  [/\b(rgb|hsl)a?\(/, "raw color"],
  [/className=["'`{][^"'`}]*\b[a-z-]+-\[[^\]]+\]/, "arbitrary Tailwind value"],
  [/from\s+["'](@mui|antd|@chakra-ui|@mantine|bootstrap|@radix-ui)/, "other UI kit"],
];

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(tsx|ts|css)$/.test(f) ? [join(d, f)] : []));

for (const { dir, manifest } of loadManifests()) {
  const designFile = join(dir, "DESIGN.md");
  const design = existsSync(designFile) ? read(designFile) : "";
  let deviations = 0;
  for (const file of existsSync(join(dir, "src")) ? walk(join(dir, "src")) : []) {
    const rel = relative(dir, file);
    read(file)
      .split("\n")
      .forEach((line, i) => {
        const hit = DEVIATIONS.find(([re]) => re.test(line));
        if (!hit) return;
        deviations++;
        if (!design.includes(rel)) fail(`apps/${manifest.name}/${rel}:${i + 1}: ${hit[1]} without a DESIGN.md entry for ${rel} (ui-override skill)`);
      });
  }
  if (design && deviations === 0 && !/responsive-exception:/.test(design)) warn(`apps/${manifest.name}/DESIGN.md lists no live deviation; remove it`);
}
done("check-design");
