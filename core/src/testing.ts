import pg from "pg";
import { closeDb } from "./db";
import { flushLogs } from "./log";
import { roleOf, schemaOf } from "./manifest";
import { registerModules, type RegisteredModule } from "./runtime";

export { invoke } from "./runtime";

/** Registers modules for a test file. Cross-module calls only resolve to modules registered here. */
export function useModules(modules: RegisteredModule[]) {
  registerModules(modules);
}

/** Empties a module's tables between tests, using the owner connection (tests only). */
export async function resetModule(module: string) {
  const client = new pg.Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query("select tablename from pg_tables where schemaname = $1", [schemaOf(module)]);
    if (rows.length) await client.query(`truncate ${rows.map((r) => `"${schemaOf(module)}"."${r.tablename}"`).join(", ")} restart identity`);
  } finally {
    await client.end();
  }
}

/** Runs SQL under a module's generated DB role, to prove cross-schema access fails. */
export async function queryAsModule(module: string, text: string) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`set local role "${roleOf(module)}"`);
    return (await client.query(text)).rows;
  } finally {
    await client.query("rollback").catch(() => {});
    await client.end();
  }
}

export async function teardown() {
  await flushLogs();
  await closeDb();
}
