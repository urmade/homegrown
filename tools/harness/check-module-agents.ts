import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadManifests } from "../../core/src/manifest";
import { done, fail, read } from "./lib";

/** Module AGENTS.md files are add-only local constraints: max 60 lines, and they may not loosen the root rules. */
const BANNED = [/\bcore\//i, /\bskip/i, /\bdisable/i, /\bbypass/i, /without evidence/i];
for (const { dir, manifest } of loadManifests()) {
  const file = join(dir, "AGENTS.md");
  if (!existsSync(file)) continue;
  const lines = read(file).split("\n");
  if (lines.length > 60) fail(`apps/${manifest.name}/AGENTS.md has ${lines.length} lines (max 60)`);
  lines.forEach((l, i) => {
    const hit = BANNED.find((b) => b.test(l));
    if (hit) fail(`apps/${manifest.name}/AGENTS.md:${i + 1}: banned phrase ${hit}`);
  });
}
done("check-module-agents");
