import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isHarness } from "../lib";

const shell = (paths: string[]) => spawnSync("bash", ["tools/harness/is-harness.sh"], { input: paths.join("\n") + "\n" }).status === 0;

const SAMPLES = [
  "AGENTS.md",
  "harness.lock.json",
  ".github/workflows/ci.yml",
  ".github/CODEOWNERS",
  ".cursor/rules/00-core.mdc",
  ".cursor/skills/cleanup/SKILL.md",
  ".cursor/agents/reviewer.md",
  ".cursor/hooks.json",
  ".cursor/hooks/stop-gate.mjs",
  "tools/harness/auto-merge.sh",
  "apps/pantry/src/view.tsx",
  "apps/pantry/AGENTS.md",
  "docs/AGENTS.md",
  "core/src/db.ts",
  "README.md",
  ".cursor/environment.json",
  "toolsXharness/x",
];

describe("harness detection", () => {
  it("harness.paths.single-source is-harness.sh and lib.isHarness agree on every path, both from CODEOWNERS", () => {
    for (const p of SAMPLES) expect([p, shell([p])]).toEqual([p, isHarness(p)]);
    expect(SAMPLES.filter(isHarness)).toEqual(SAMPLES.slice(0, 10));
  });

  it("harness.paths.mixed a diff with any harness path is harness", () => {
    expect(shell(["apps/pantry/src/view.tsx", "tools/harness/check-core.ts"])).toBe(true);
    expect(shell(["apps/pantry/src/view.tsx", "docs/specs/0003.md"])).toBe(false);
  });

  it("harness.paths.renames-deletions moving or deleting a harness file is harness (git diff --no-renames)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hg-renames-"));
    const git = (...a: string[]) => execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...a], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    execFileSync("mkdir", ["-p", join(dir, "tools/harness"), join(dir, "apps/x")]);
    writeFileSync(join(dir, "tools/harness/check.ts"), "export const gate = 1;\n".repeat(20));
    writeFileSync(join(dir, "tools/harness/old.ts"), "x\n");
    git("add", "-A");
    git("commit", "-qm", "base");
    git("mv", "tools/harness/check.ts", "apps/x/check.ts");
    git("rm", "-q", "tools/harness/old.ts");
    git("commit", "-qm", "move out of harness");
    const withRenames = git("diff", "--name-only", "HEAD~1", "HEAD").trim().split("\n");
    const noRenames = git("diff", "--name-only", "--no-renames", "HEAD~1", "HEAD").trim().split("\n");
    expect(noRenames).toEqual(expect.arrayContaining(["tools/harness/check.ts", "apps/x/check.ts", "tools/harness/old.ts"]));
    expect(shell(noRenames)).toBe(true);
    expect(shell(withRenames.filter((p) => p !== "tools/harness/old.ts"))).toBe(false);
  });
});
