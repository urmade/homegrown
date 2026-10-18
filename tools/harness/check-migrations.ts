import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadManifests, schemaOf } from "../../core/src/manifest";
import { changedFiles, done, fail, read } from "./lib";

/**
 * Forward-only and additive: applied migrations are never edited, modules stay in their own schema,
 * destructive statements only in a contract migration whose deprecation started 7+ days ago.
 */
const schemas = ["core", "logs", "public", ...loadManifests().map((m) => schemaOf(m.manifest.name))];
const DESTRUCTIVE = /\b(drop\s+(table|column|schema|index|view)|rename\s+(to|column)|alter\s+column\s+\w+\s+(set\s+data\s+)?type|truncate)\b/i;
const FORBIDDEN = /\b(create\s+schema|set\s+(local\s+)?role|grant|revoke|alter\s+(role|default\s+privileges)|create\s+extension)\b/i;

for (const { status, path } of changedFiles().filter((c) => /\/migrations\/[^/]+\.sql$/.test(c.path))) {
  if (status !== "A") {
    fail(`${path}: migrations are forward-only; add a new file instead of editing or deleting (${status})`);
    continue;
  }
  const dir = dirname(path);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(path.split("/").pop()!)) fail(`${path}: name must be NNNN_snake_case.sql`);
  if (files.at(-1) !== path.split("/").pop()) fail(`${path}: new migrations must sort last in ${dir}`);
  if (path.startsWith("core/")) continue;

  const own = schemaOf(path.split("/")[1]!);
  const sql = read(path).replace(/--.*$/gm, "");
  const foreign = schemas.filter((s) => s !== own && new RegExp(`\\b${s}\\s*\\.`, "i").test(sql));
  if (foreign.length) fail(`${path}: references schema(s) ${foreign.join(", ")}; modules only touch their own schema and reference others by core member id`);
  if (/\breferences\s+\w+\s*\.\s*\w+/i.test(sql)) fail(`${path}: schema-qualified foreign key; no cross-module foreign keys`);
  if (FORBIDDEN.test(sql)) fail(`${path}: schema, role and privilege changes belong to core`);
  if (DESTRUCTIVE.test(sql)) {
    const m = /--\s*contract:\s*deprecated\s+(\d{4}-\d{2}-\d{2})/.exec(read(path));
    const age = m ? (Date.now() - Date.parse(m[1]!)) / 86_400_000 : -1;
    if (age < 7) fail(`${path}: destructive change needs expand-contract: header "-- contract: deprecated YYYY-MM-DD" at least 7 days old (see migration-expand-contract skill)`);
  }
}
done("check-migrations");
