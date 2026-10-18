import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { changedFiles, read } from "./lib";
import { planItems } from "./plan-items";

/**
 * Drift report for the PR comment: new dependencies, new cross-module connections, duplicate code,
 * deleted tests. Informational; the hard gates live in the other checks.
 */
const items = planItems();
const section = (title: string, lines: string[]) => (lines.length ? `### ${title}\n${lines.join("\n")}\n` : "");

let duplicates: string[] = [];
try {
  execFileSync("pnpm", ["exec", "jscpd", "--config", "tools/harness/jscpd.json"], { stdio: "ignore" });
} catch {}
if (existsSync("artifacts/jscpd/jscpd-report.json")) {
  const report = JSON.parse(read("artifacts/jscpd/jscpd-report.json")) as {
    duplicates: { firstFile: { name: string; start: number }; secondFile: { name: string; start: number }; lines: number }[];
  };
  const touched = new Set(changedFiles().map((c) => c.path));
  duplicates = report.duplicates
    .filter((d) => touched.has(d.firstFile.name) || touched.has(d.secondFile.name))
    .map((d) => `- ${d.lines} lines: \`${d.firstFile.name}:${d.firstFile.start}\` ≈ \`${d.secondFile.name}:${d.secondFile.start}\``);
}

const body = [
  "<!-- homegrown-drift -->",
  "## Drift report",
  section("New dependencies", items.filter((i) => i.kind === "dependency").map((i) => `- \`${i.name}\``)),
  section("New modules and tables", items.filter((i) => i.kind === "module" || i.kind === "table").map((i) => `- ${i.kind} \`${i.name}\``)),
  section("New cross-module connections", items.filter((i) => i.kind === "call").map((i) => `- → \`${i.name}\``)),
  section("Duplicate code (reviewer must accept or send back)", duplicates),
  section("Deleted tests", changedFiles().filter((c) => c.status === "D" && /\.(test|spec)\.tsx?$/.test(c.path)).map((c) => `- \`${c.path}\``)),
]
  .filter(Boolean)
  .join("\n");

const out = body.split("\n").length > 2 ? body : `${body}\nNo drift.`;
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/drift.md", out);
process.stdout.write(`${out}\n`);
