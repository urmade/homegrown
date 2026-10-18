import { readFileSync } from "node:fs";
import { readInput, relPath, sh } from "./lib.mjs";

// Soft guard (check-core in CI is the real one): reverts edits to core/ outside upgrade-core branches and the upstream repo.
const input = await readInput();
const file = relPath(input.file_path);
const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
const upstream = JSON.parse(readFileSync("harness.lock.json", "utf8")).upstream;
const origin = sh("git", ["remote", "get-url", "origin"]).out;

if (file.startsWith("core/") && !branch.startsWith("upgrade-core/") && !origin.includes(upstream)) {
  const tracked = sh("git", ["ls-files", "--error-unmatch", file]).ok;
  if (tracked) sh("git", ["checkout", "--", file]);
  else sh("rm", ["-f", file]);
  process.stderr.write(`guard-core: reverted ${file}. core/ is vendored and read-only; use the upgrade-core skill.\n`);
}
process.stdout.write("{}\n");
