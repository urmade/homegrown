import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { done, fail, read } from "./lib";

/** Every acceptance criterion "- [test.id] ..." in docs/specs maps to a test whose title starts with that id. */
function files(dir: string, re: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === "node_modules" || f.startsWith(".")) return [];
    return statSync(p).isDirectory() ? files(p, re) : re.test(f) ? [p] : [];
  });
}

const tests = [...files("apps", /\.(test|spec)\.tsx?$/), ...files("core", /\.test\.ts$/), ...files("packages", /\.test\.ts$/), ...files("tools/harness", /\.(test|spec)\.ts$/)]
  .map(read)
  .join("\n");

for (const spec of files("docs/specs", /\.md$/)) {
  const section = /^## Acceptance criteria\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(read(spec))?.[1];
  if (section === undefined) {
    fail(`${spec}: missing "## Acceptance criteria"`);
    continue;
  }
  for (const line of section.split("\n").filter((l) => /^\s*-\s/.test(l))) {
    const id = /^\s*-\s*\[([a-z0-9.-]+)\]/.exec(line)?.[1];
    if (!id) fail(`${spec}: criterion without a test id: "${line.trim()}"`);
    else if (!new RegExp(`(test|it)(\\.\\w+)?\\(\\s*["'\`]${id.replace(/[.-]/g, "\\$&")}\\b`).test(tests))
      fail(`${spec}: no test titled "${id} ..." for criterion`);
  }
}
done("check-evidence");
