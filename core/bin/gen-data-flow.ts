import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataFlow, introspect } from "../src/dataflow";
import { loadManifests, repoRoot, schemaOf } from "../src/manifest";

/** Writes .homegrown/data-flow.json from module.json plus information_schema (run after migrations). */
export async function genDataFlow() {
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL is required");
  const root = repoRoot();
  const manifests = loadManifests(root).map((m) => m.manifest);
  const columns = await introspect(url, manifests.map((m) => schemaOf(m.name)));
  const flow = buildDataFlow(manifests, columns, process.env.HG_SHA ?? null);
  mkdirSync(join(root, ".homegrown"), { recursive: true });
  writeFileSync(join(root, ".homegrown/data-flow.json"), `${JSON.stringify(flow, null, 2)}\n`);
  return flow;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flow = await genDataFlow();
  for (const e of flow.errors) process.stderr.write(`data-flow: ${e}\n`);
  process.stdout.write(`data-flow.json: ${flow.tables.length} tables, ${flow.calls.length} cross-module calls\n`);
  if (flow.errors.length) process.exit(1);
}
