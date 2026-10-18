import { existsSync } from "node:fs";
import { genDataFlow } from "../../core/bin/gen-data-flow";
import { done, fail, read, warn } from "./lib";

/**
 * Runs after migrations and the test suite. Fails on any declared table, column or call that does not
 * exist. Undeclared access already fails the tests (ctx.db recorder); declared-but-unused access warns.
 */
const flow = await genDataFlow();
for (const e of flow.errors) fail(e);

const record = process.env.HG_RECORD_FILE ?? "artifacts/db-access.jsonl";
if (existsSync(record)) {
  const seen = new Set(
    read(record)
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { fn: string; table: string; column: string })
      .map((a) => `${a.fn}:${a.table}.${a.column}`),
  );
  for (const m of flow.modules)
    for (const f of m.functions)
      for (const ref of [...f.reads, ...f.writes])
        if (!seen.has(`${m.name}.${f.name}:${ref}`)) warn(`${m.name}.${f.name} declares ${ref} but no test exercised it`);
} else warn(`${record} not found; run the test suite first`);

done(`check-data-flow (${flow.tables.length} tables, ${flow.calls.length} calls)`);
