import pg from "pg";
import { schemaOf, type ModuleManifest } from "./manifest";

export type DataFlow = {
  generatedAt: string;
  sha: string | null;
  tables: {
    name: string;
    owner: string;
    columns: { name: string; type: string; readers: string[]; writers: string[] }[];
  }[];
  modules: {
    name: string;
    title: string;
    exports: Record<string, string>;
    functions: { name: string; reads: string[]; writes: string[]; calls: string[] }[];
  }[];
  calls: { from: string; to: string }[];
  errors: string[];
};

export type ColumnInfo = { schema: string; table: string; column: string; type: string };

export async function introspect(url: string, schemas: string[]): Promise<ColumnInfo[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select table_schema as schema, table_name as table, column_name as column, data_type as type
       from information_schema.columns where table_schema = any($1) order by table_schema, table_name, ordinal_position`,
      [schemas],
    );
    return rows;
  } finally {
    await client.end();
  }
}

/** The one generator: declarations from module.json joined with columns that actually exist. */
export function buildDataFlow(manifests: ModuleManifest[], columns: ColumnInfo[], sha: string | null = null): DataFlow {
  const errors: string[] = [];
  const byName = new Map(manifests.map((m) => [m.name, m]));
  const tables = new Map<string, DataFlow["tables"][number]>();
  for (const c of columns) {
    const name = `${c.schema}.${c.table}`;
    const owner = manifests.find((m) => schemaOf(m.name) === c.schema)?.name ?? c.schema;
    const t = tables.get(name) ?? { name, owner, columns: [] };
    t.columns.push({ name: c.column, type: c.type, readers: [], writers: [] });
    tables.set(name, t);
  }

  const calls: DataFlow["calls"] = [];
  for (const m of manifests) {
    const schema = schemaOf(m.name);
    for (const t of m.tables) if (!tables.has(`${schema}.${t}`)) errors.push(`${m.name}: declared table ${t} does not exist`);
    for (const t of tables.values())
      if (t.owner === m.name && !m.tables.includes(t.name.split(".")[1]!)) errors.push(`${m.name}: table ${t.name} is not declared in tables`);
    for (const exp of Object.keys(m.exports))
      if (!m.functions.some((f) => f.name === exp)) errors.push(`${m.name}: export ${exp} has no function`);
    for (const f of m.functions) {
      const fn = `${m.name}.${f.name}`;
      for (const [list, key] of [[f.reads, "readers"], [f.writes, "writers"]] as const) {
        for (const ref of list) {
          const [table, column] = ref.split(".") as [string, string];
          const t = tables.get(`${schema}.${table}`);
          const cols = column === "*" ? t?.columns : t?.columns.filter((c) => c.name === column);
          if (!t || !cols?.length) errors.push(`${fn}: ${ref} does not exist in schema ${schema}`);
          for (const c of cols ?? []) if (!c[key].includes(fn)) c[key].push(fn);
        }
      }
      for (const target of f.calls) {
        const [tm, cap] = target.split(".") as [string, string];
        if (tm === m.name) errors.push(`${fn}: calls its own module; call the function directly`);
        else if (!byName.get(tm)) errors.push(`${fn}: calls unknown module ${tm}`);
        else if (!(cap in byName.get(tm)!.exports)) errors.push(`${fn}: ${target} is not exported by ${tm}`);
        calls.push({ from: fn, to: target });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sha,
    tables: [...tables.values()],
    modules: manifests.map((m) => ({ name: m.name, title: m.title, exports: m.exports, functions: m.functions })),
    calls,
    errors,
  };
}
