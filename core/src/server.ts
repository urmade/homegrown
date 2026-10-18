import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { baseDb } from "./db";
import type { DataFlow } from "./dataflow";
import { sql } from "kysely";
import { repoRoot, roleOf } from "./manifest";
import { registerModules, registeredModules, type RegisteredModule } from "./runtime";

export { invoke, auth, InputError, registeredModules } from "./runtime";
export { baseDb } from "./db";
export { log, errorData, flushLogs } from "./log";
export { withContext } from "./context";

let booted = false;
export function boot(modules: RegisteredModule[]) {
  if (booted) return;
  registerModules(modules);
  booted = true;
}

export type LogFilter = { module?: string; level?: string; correlationId?: string; sha?: string };

export async function queryLogs(f: LogFilter, limit = 200) {
  let q = baseDb()
    .selectFrom("logs.logs")
    .select(["id", "ts", "level", "module", "fn", "correlation_id", "sha", "msg", "data"])
    .orderBy("ts", "desc")
    .limit(limit);
  if (f.module) q = q.where("module", "=", f.module);
  if (f.level) q = q.where("level", "=", f.level);
  if (f.correlationId) q = q.where("correlation_id", "=", f.correlationId);
  if (f.sha) q = q.where("sha", "=", f.sha);
  return q.execute();
}

export async function recentEvents(limit = 20) {
  return baseDb().selectFrom("core.events").select(["id", "ts", "kind", "sha", "detail"]).orderBy("ts", "desc").limit(limit).execute();
}

export async function getFlag(name: string): Promise<boolean> {
  const row = await baseDb().selectFrom("core.flags").select("enabled").where("name", "=", name).executeTakeFirst();
  return row?.enabled ?? false;
}

export async function setFlag(name: string, enabled: boolean) {
  await baseDb().transaction().execute(async (trx) => {
    await trx.updateTable("core.flags").set({ enabled, updated_at: new Date() }).where("name", "=", name).execute();
    await trx.insertInto("core.events").values({ kind: "flag", sha: process.env.HG_SHA ?? null, detail: JSON.stringify({ flag: name, enabled }) }).execute();
  });
}

/** data-flow.json is a build artifact baked into the image; never committed. */
export function readDataFlow(): DataFlow | null {
  const file = process.env.HG_DATA_FLOW ?? join(repoRoot(), ".homegrown/data-flow.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as DataFlow) : null;
}

export async function moduleHealth(name: string) {
  if (!registeredModules().some((m) => m.manifest.name === name)) return null;
  await baseDb()
    .transaction()
    .execute((trx) => sql`set local role ${sql.id(roleOf(name))}`.execute(trx));
  return { module: name, ok: true };
}
