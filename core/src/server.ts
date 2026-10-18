import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { baseDb } from "./db";
import type { DataFlow } from "./dataflow";
import { sql } from "kysely";
import { repoRoot, roleOf } from "./manifest";
import { auth, InputError, registerModules, registeredModules, type RegisteredModule } from "./runtime";
import { DEFAULT_LOCALE, messagesFor, translator, type Catalogs, type Messages, type Translate } from "./i18n";
import coreEn from "../messages/en.json";
import coreDe from "../messages/de.json";

export { translator, type Messages, type Translate } from "./i18n";

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

const coreCatalogs: Catalogs = { en: coreEn, de: coreDe };
export const LOCALES = Object.keys(coreCatalogs);

export async function householdLocale(): Promise<string | null> {
  const row = await baseDb().selectFrom("core.settings").select("value").where("key", "=", "household_locale").executeTakeFirst();
  return row?.value ?? null;
}

/** Member override, then household default, then English. Falls back to English when the DB is unreachable. */
export async function resolveLocale(): Promise<string> {
  try {
    const member = await auth.currentMember();
    const row = await baseDb()
      .selectNoFrom((eb) => [
        eb.selectFrom("core.members").select("locale").where("id", "=", member.id).as("member"),
        eb.selectFrom("core.settings").select("value").where("key", "=", "household_locale").as("household"),
      ])
      .executeTakeFirst();
    const locale = row?.member ?? row?.household ?? DEFAULT_LOCALE;
    return LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function memberLocale(): Promise<string | null> {
  const member = await auth.currentMember();
  const row = await baseDb().selectFrom("core.members").select("locale").where("id", "=", member.id).executeTakeFirst();
  return row?.locale ?? null;
}

/** "core" for the shell and admin pages, otherwise a module name. */
export async function getMessages(namespace: string, locale?: string): Promise<Messages> {
  const catalogs = namespace === "core" ? coreCatalogs : registeredModules().find((m) => m.manifest.name === namespace)?.messages;
  return messagesFor(catalogs ?? {}, locale ?? (await resolveLocale()));
}

export async function getT(namespace: string, locale?: string): Promise<Translate> {
  return translator(await getMessages(namespace, locale));
}

export async function setHouseholdLocale(locale: string) {
  if (!LOCALES.includes(locale)) throw new InputError(`unsupported locale ${locale}`);
  await baseDb().transaction().execute(async (trx) => {
    await trx
      .insertInto("core.settings")
      .values({ key: "household_locale", value: locale })
      .onConflict((oc) => oc.column("key").doUpdateSet({ value: locale, updated_at: new Date() }))
      .execute();
    await trx.insertInto("core.events").values({ kind: "setting", sha: process.env.HG_SHA ?? null, detail: JSON.stringify({ household_locale: locale }) }).execute();
  });
}

export async function setMemberLocale(locale: string | null) {
  if (locale !== null && !LOCALES.includes(locale)) throw new InputError(`unsupported locale ${locale}`);
  const member = await auth.currentMember();
  await baseDb().updateTable("core.members").set({ locale }).where("id", "=", member.id).execute();
}

export async function moduleHealth(name: string) {
  if (!registeredModules().some((m) => m.manifest.name === name)) return null;
  await baseDb()
    .transaction()
    .execute((trx) => sql`set local role ${sql.id(roleOf(name))}`.execute(trx));
  return { module: name, ok: true };
}
