import { mkdirSync, rmSync } from "node:fs";
import { migrate } from "../../core/src/migrate";

/** Migrates the test database once (unless N-1 runs older tests against a newer schema) and resets the access record. */
export default async function setup() {
  mkdirSync("artifacts", { recursive: true });
  if (process.env.HG_RECORD_FILE) rmSync(process.env.HG_RECORD_FILE, { force: true });
  if (process.env.HG_SKIP_MIGRATE === "1") return;
  const url = process.env.MIGRATE_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/homegrown_test";
  await migrate({ url, appRole: process.env.APP_DB_ROLE ?? "homegrown_app", appPassword: process.env.APP_DB_PASSWORD ?? "app" });
}
