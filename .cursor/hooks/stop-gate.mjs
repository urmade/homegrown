import { mkdirSync, writeFileSync } from "node:fs";
import { readInput, sh } from "./lib.mjs";

// Typecheck plus tests related to touched files, then a run record for the PR body. Full suite runs in CI.
const input = await readInput();
const touched = sh("git", ["diff", "--name-only", "HEAD"]).out.split("\n").filter(Boolean);
const untracked = sh("git", ["ls-files", "--others", "--exclude-standard"]).out.split("\n").filter(Boolean);
const files = [...touched, ...untracked].filter((f) => /\.(ts|tsx|json|sql)$/.test(f));

let stage = "done";
let signature = null;
let detail = "";
if (files.length) {
  const tc = sh("pnpm", ["-s", "typecheck"]);
  if (!tc.ok) [stage, signature, detail] = ["typecheck", "typecheck", tc.out];
  else if (process.env.MIGRATE_DATABASE_URL) {
    const tests = sh("pnpm", ["exec", "vitest", "related", "--run", "-c", "tools/harness/vitest.config.mts", ...files.filter((f) => /\.tsx?$/.test(f))]);
    if (!tests.ok && !/No test files found/.test(tests.out)) [stage, signature, detail] = ["test", "vitest", tests.out];
  }
}

const record = { outcome: signature ? "failed" : "passed", stage, signature, fix: null, paths: files, loop: input.loop_count ?? 0, at: new Date().toISOString() };
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/run-record.json", `${JSON.stringify(record, null, 2)}\n`);

if (signature && (input.loop_count ?? 0) < 3)
  process.stdout.write(`${JSON.stringify({ followup_message: `stop-gate: ${stage} failed. Fix it before finishing.\n${detail.slice(-3000)}` })}\n`);
else process.stdout.write("{}\n");
