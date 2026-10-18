import { appendFileSync } from "node:fs";
import pg from "pg";
import {
  Kysely,
  PostgresDialect,
  type KyselyPlugin,
  type OperationNode,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
} from "kysely";
import { log } from "./log";
import { schemaOf, type FunctionDecl } from "./manifest";

let base: Kysely<unknown> | undefined;

/** App-role connection. Modules never get this directly; they get a role-scoped transaction via ctx.db. */
export function baseDb(): Kysely<any> {
  if (!base) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    base = new Kysely({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 10 }) }) });
  }
  return base;
}

export async function closeDb() {
  await base?.destroy();
  base = undefined;
}

export type Access = { kind: "read" | "write"; table: string; column: string };

type AnyNode = OperationNode & Record<string, any>;

const tableName = (t: AnyNode) => ({ schema: t.table?.schema?.name as string | undefined, table: t.table?.identifier?.name as string });

/** Collects table.column reads and writes from a Kysely query tree. Raw SQL fragments are not parsed. */
export function collectAccess(root: RootOperationNode): { accesses: Access[]; raw: boolean; schemas: string[] } {
  const tables: { schema?: string; table: string }[] = [];
  const refs: { table?: string; column: string; write: boolean }[] = [];
  let raw = false;
  const writeCols = new Set<OperationNode>();

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as AnyNode;
    switch (n.kind) {
      case "RawNode":
        raw = true;
        break;
      case "TableNode":
        tables.push(tableName(n));
        return;
      case "InsertQueryNode":
        for (const c of n.columns ?? []) writeCols.add(c);
        break;
      case "ColumnUpdateNode":
        writeCols.add(n.column);
        break;
      case "ReferenceNode":
        if (n.column?.kind === "ColumnNode") {
          refs.push({ table: n.table ? tableName(n.table).table : undefined, column: n.column.column.name, write: false });
          return;
        }
        if (n.column?.kind === "SelectAllNode") {
          refs.push({ table: n.table ? tableName(n.table).table : undefined, column: "*", write: false });
          return;
        }
        break;
      case "SelectAllNode":
        refs.push({ column: "*", write: false });
        return;
      case "ColumnNode":
        refs.push({ column: n.column.name, write: writeCols.has(n) });
        return;
    }
    for (const [k, v] of Object.entries(n)) if (k !== "kind" && k !== "direction") visit(v);
  };
  visit(root);

  const first = tables[0]?.table ?? "?";
  const accesses: Access[] = refs.map((r) => ({ kind: r.write ? "write" : "read", table: r.table ?? first, column: r.column }));
  if (root.kind === "DeleteQueryNode") accesses.push({ kind: "write", table: first, column: "*" });
  return { accesses, raw, schemas: [...new Set(tables.map((t) => t.schema ?? "public"))] };
}

/**
 * Records every ctx.db access as function -> table.column. Undeclared access throws in tests
 * (CI fails) and warns in production. Writes are logged as the audit trail.
 */
export class AccessRecorder implements KyselyPlugin {
  constructor(
    private module: string,
    private decl: FunctionDecl,
  ) {}

  transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
    const { accesses, raw, schemas } = collectAccess(node);
    const own = schemaOf(this.module);
    const fn = `${this.module}.${this.decl.name}`;
    const problems: string[] = [];
    if (raw) log.warn("db.raw_sql", { route: fn });
    for (const s of schemas) if (s !== own) problems.push(`schema ${s} is not owned by ${this.module}`);
    const seen = new Set<string>();
    for (const a of accesses) {
      const key = `${a.kind}:${a.table}.${a.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const declared = a.kind === "write" ? this.decl.writes : [...this.decl.reads, ...this.decl.writes];
      if (!declared.includes(`${a.table}.${a.column}`)) problems.push(`undeclared ${a.kind} ${a.table}.${a.column}`);
      if (process.env.HG_RECORD_FILE) appendFileSync(process.env.HG_RECORD_FILE, `${JSON.stringify({ fn, ...a })}\n`);
    }
    const writes = accesses.filter((a) => a.kind === "write");
    if (writes.length) log.info("db.write", { table: writes[0]!.table, columns: [...new Set(writes.map((w) => w.column))] });
    if (problems.length) {
      const msg = `${fn}: ${problems.join("; ")} (declare it in apps/${this.module}/module.json)`;
      if (process.env.NODE_ENV === "test") throw new Error(msg);
      log.warn("db.undeclared_access", { error: msg });
    }
    return node;
  }

  async transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return result;
  }
}
