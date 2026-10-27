import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { afterAll, expect, it } from "vitest";
import { restoreDump } from "../src/agent";

const admin = process.env.MIGRATE_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/homegrown_test";
const id = `r${process.pid}${Date.now().toString(36)}`;
const role = `hg_mod_${id}`;
const schema = id;
const srcDb = `hg_${id}_src`;
const dstDb = `hg_${id}_dst`;

function urlFor(db: string) {
  const u = new URL(admin);
  u.pathname = `/${db}`;
  return u.toString();
}

function adminDb() {
  const u = new URL(admin);
  u.pathname = "/postgres";
  return u.toString();
}

async function cleanup(c: pg.Client) {
  await c.query(`drop database if exists ${srcDb} with (force)`).catch(() => {});
  await c.query(`drop database if exists ${dstDb} with (force)`).catch(() => {});
  await c.query(`drop role if exists ${role}`).catch(() => {});
}

const adminClient = new pg.Client({ connectionString: adminDb() });
await adminClient.connect();
afterAll(async () => {
  await cleanup(adminClient);
  await adminClient.end();
});

it("deploy.staging-restore-owns-schema restore then create/alter as the module role succeeds", async () => {
  await cleanup(adminClient);
  await adminClient.query(`create role ${role} nologin`);
  await adminClient.query(`create database ${srcDb}`);

  const src = new pg.Client({ connectionString: urlFor(srcDb) });
  await src.connect();
  await src.query(`create schema ${schema} authorization ${role}`);
  await src.query(`set role ${role}`);
  await src.query(`create table ${schema}.items (id int primary key, name text)`);
  await src.query("reset role");
  await src.end();

  const dump = join(mkdtempSync(join(tmpdir(), "hg-dump-")), `${id}.dump`);
  execFileSync("pg_dump", ["-Fc", "-f", dump, urlFor(srcDb)]);

  await adminClient.query(`create database ${dstDb}`);
  restoreDump(dump, urlFor(dstDb));

  const dst = new pg.Client({ connectionString: urlFor(dstDb) });
  await dst.connect();
  try {
    const owner = await dst.query<{ o: string }>("select pg_get_userbyid(nspowner) as o from pg_namespace where nspname = $1", [schema]);
    expect(owner.rows[0]?.o).toBe(role);

    await dst.query("begin");
    await dst.query(`set local role ${role}; set local search_path to ${schema}`);
    await dst.query("create table extras (id int primary key)");
    await dst.query("alter table items add column note text");
    await dst.query("commit");

    const cols = await dst.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = $1 and table_name = 'items' order by column_name",
      [schema],
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(["id", "name", "note"]);
    const extra = await dst.query("select 1 from information_schema.tables where table_schema = $1 and table_name = 'extras'", [schema]);
    expect(extra.rowCount).toBe(1);
  } finally {
    await dst.end();
  }
});
