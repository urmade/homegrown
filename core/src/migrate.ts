import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadManifests, repoRoot, roleOf, schemaOf } from "./manifest";

const LOCK_ID = 7_146_001;
const ident = (s: string) => `"${s.replaceAll('"', '""')}"`;
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;

export type MigrationTarget = { module: string; dir: string };

export function migrationTargets(root = repoRoot()): MigrationTarget[] {
  return [
    { module: "core", dir: join(root, "core/migrations") },
    ...loadManifests(root).map((m) => ({ module: m.manifest.name, dir: join(m.dir, "migrations") })),
  ];
}

export const checksum = (sql: string) => createHash("sha256").update(sql).digest("hex");

/**
 * Forward-only ledger: one locked runner, checksummed files. Module migrations run as the module's
 * role with search_path set to its schema, so they cannot touch other schemas or core.
 */
export async function migrate(opts: { url: string; appRole: string; appPassword?: string; root?: string; log?: (m: string) => void }) {
  const say = opts.log ?? (() => {});
  const client = new pg.Client({ connectionString: opts.url });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(`create schema if not exists core;
      create table if not exists core.migrations (
        module text not null, name text not null, checksum text not null,
        applied_at timestamptz not null default now(), primary key (module, name))`);
    await client.query(`do $$ begin
      if not exists (select from pg_roles where rolname = ${literal(opts.appRole)}) then
        create role ${ident(opts.appRole)} login noinherit;
      end if; end $$`);
    if (opts.appPassword) await client.query(`alter role ${ident(opts.appRole)} password ${literal(opts.appPassword)}`);

    const applied = new Map<string, string>(
      (await client.query("select module || '/' || name as k, checksum from core.migrations")).rows.map((r) => [r.k, r.checksum]),
    );

    for (const t of migrationTargets(opts.root)) {
      const role = roleOf(t.module);
      const schema = schemaOf(t.module);
      if (t.module !== "core") {
        await client.query(`do $$ begin
          if not exists (select from pg_roles where rolname = ${literal(role)}) then create role ${ident(role)} nologin; end if;
          end $$;
          create schema if not exists ${ident(schema)} authorization ${ident(role)};
          grant ${ident(role)} to ${ident(opts.appRole)};
          revoke all on schema public from ${ident(role)};`);
      }
      const files = existsSync(t.dir) ? readdirSync(t.dir).filter((f) => f.endsWith(".sql")).sort() : [];
      for (const name of files) {
        const body = readFileSync(join(t.dir, name), "utf8");
        const sum = checksum(body);
        const prev = applied.get(`${t.module}/${name}`);
        if (prev && prev !== sum) throw new Error(`${t.module}/${name} was edited after it was applied; add a new migration instead`);
        if (prev) continue;
        await client.query("begin");
        try {
          if (t.module !== "core") await client.query(`set local role ${ident(role)}; set local search_path to ${ident(schema)}`);
          await client.query(body);
          await client.query("reset role; reset search_path");
          await client.query("insert into core.migrations (module, name, checksum) values ($1, $2, $3)", [t.module, name, sum]);
          await client.query("insert into core.events (kind, detail) values ('migration', $1)", [{ module: t.module, name }]);
          await client.query("commit");
          say(`applied ${t.module}/${name}`);
        } catch (e) {
          await client.query("rollback");
          throw new Error(`${t.module}/${name}: ${(e as Error).message}`);
        }
      }
    }

    // The app role reads and appends; it never owns core tables and can't run core DDL.
    const app = ident(opts.appRole);
    await client.query(`
      grant usage on schema core, logs to ${app};
      grant select on core.members, core.migrations to ${app};
      grant select, insert on core.events, logs.logs to ${app};
      grant select, update on core.flags to ${app};
      grant usage on all sequences in schema core, logs to ${app};`);
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    await client.end();
  }
}
