import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";
import { buildDataFlow } from "../src/dataflow";
import { collectAccess } from "../src/db";
import { redact } from "../src/log";
import { ModuleManifest } from "../src/manifest";
import { runtimeCaching } from "../src/pwa";

const db = new Kysely<any>({
  dialect: { createAdapter: () => new PostgresAdapter(), createDriver: () => new DummyDriver(), createIntrospector: (k) => new PostgresIntrospector(k), createQueryCompiler: () => new PostgresQueryCompiler() },
});

const pantry = ModuleManifest.parse({
  name: "pantry",
  title: "Vorrat",
  description: "d",
  tables: ["items"],
  exports: { listLowStock: "low" },
  functions: [{ name: "listLowStock", reads: ["items.name"] }],
});

describe("ctx.db recorder", () => {
  it("core.recorder.select records read columns per table", () => {
    const q = db.selectFrom("pantry.items").select(["id", "name"]).where("quantity", "<", 1).orderBy("name", "desc");
    const { accesses, schemas, raw } = collectAccess(q.toOperationNode());
    expect(schemas).toEqual(["pantry"]);
    expect(raw).toBe(false);
    expect(new Set(accesses.map((a) => `${a.kind}:${a.table}.${a.column}`))).toEqual(new Set(["read:items.id", "read:items.name", "read:items.quantity"]));
  });

  it("core.recorder.write records written columns for insert, update and delete", () => {
    const ins = collectAccess(db.insertInto("s.entries").values({ title: "x", done: false }).returning("id").toOperationNode());
    expect(ins.accesses.filter((a) => a.kind === "write").map((a) => a.column).sort()).toEqual(["done", "title"]);
    expect(ins.accesses.find((a) => a.kind === "read")?.column).toBe("id");
    const upd = collectAccess(db.updateTable("s.entries").set({ done: true }).where("id", "=", "1").toOperationNode());
    expect(upd.accesses).toContainEqual({ kind: "write", table: "entries", column: "done" });
    expect(upd.accesses).toContainEqual({ kind: "read", table: "entries", column: "id" });
    const del = collectAccess(db.deleteFrom("s.entries").where("done", "=", true).toOperationNode());
    expect(del.accesses).toContainEqual({ kind: "write", table: "entries", column: "*" });
  });
});

describe("ctx.log", () => {
  it("core.log.redact removes secrets, payloads and personal data before any sink", () => {
    const out = redact({ password: "x", apiKey: "y", input: { title: "Milch" }, email: "a@b.c", table: "items", durationMs: 3, nested: { token: "t" } });
    expect(out).toEqual({ password: "[redacted]", apiKey: "[redacted]", input: "[redacted]", email: "[redacted]", table: "items", durationMs: 3, nested: { token: "[redacted]" } });
  });
});

describe("data-flow generator", () => {
  it("core.data-flow.errors flags columns that do not exist and undeclared exports", () => {
    const bad = { ...pantry, functions: [{ name: "listLowStock", reads: ["items.nope"], writes: [], calls: ["shop.x"] }] };
    const flow = buildDataFlow([bad], [{ schema: "pantry", table: "items", column: "name", type: "text" }]);
    expect(flow.errors).toEqual(expect.arrayContaining([expect.stringContaining("items.nope does not exist"), expect.stringContaining("unknown module shop")]));
  });

  it("core.data-flow.calls lists module-to-module calls", () => {
    const shop = ModuleManifest.parse({ name: "shop", title: "S", description: "d", tables: [], functions: [{ name: "pull", calls: ["pantry.listLowStock"] }] });
    const flow = buildDataFlow([pantry, shop], [{ schema: "pantry", table: "items", column: "name", type: "text" }]);
    expect(flow.errors).toEqual([]);
    expect(flow.calls).toEqual([{ from: "shop.pull", to: "pantry.listLowStock" }]);
    expect(flow.tables[0]!.columns[0]!.readers).toEqual(["pantry.listLowStock"]);
  });
});

describe("service worker composition", () => {
  it("core.pwa.never-cache puts admin, auth and health first as network-only", () => {
    const rules = runtimeCaching([{ ...pantry, offline: { routes: ["/pantry"], data: [], strategy: "cache-first", offlineWrites: "queue" } }]);
    expect(rules[0]!.handler).toBe("NetworkOnly");
    const match = rules[0]!.urlPattern as (o: { url: URL }) => boolean;
    for (const p of ["/admin", "/admin/logs", "/api/auth/x", "/health", "/pantry/health"]) expect(match({ url: new URL(`http://h${p}`) })).toBe(true);
    expect(rules.some((r) => r.handler === "CacheFirst" && String(r.urlPattern).includes("pantry"))).toBe(true);
    expect(rules.some((r) => r.method === "POST" && r.options?.backgroundSync?.name === "writes-pantry")).toBe(true);
  });
});
