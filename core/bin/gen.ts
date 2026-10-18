import { join } from "node:path";
import { generateRegistry } from "../src/codegen";
import { repoRoot } from "../src/manifest";
import { buildServiceWorker } from "../src/pwa";

const root = repoRoot();
const mods = generateRegistry(root);
const { warnings } = await buildServiceWorker(
  mods.map((m) => m.manifest),
  join(root, "apps/web/public/sw.js"),
  process.env.HG_SHA ?? String(Date.now()),
);
for (const w of warnings) process.stderr.write(`sw: ${w}\n`);
process.stdout.write(`generated registry, clients and service worker for ${mods.length} module(s)\n`);
