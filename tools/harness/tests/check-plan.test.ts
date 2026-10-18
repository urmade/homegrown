import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = new URL("../check-plan.ts", import.meta.url).pathname;
const tsx = createRequire(import.meta.url).resolve("tsx/cli");

/** Runs check-plan in a throwaway repo where the PR adds the given specs on top of an empty base commit. */
function checkPlan(specs: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "check-plan-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { cwd: dir });
  git("init", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "base");
  mkdirSync(join(dir, "docs/specs"), { recursive: true });
  for (const [name, body] of Object.entries(specs)) writeFileSync(join(dir, "docs/specs", name), body);
  git("add", ".");
  git("commit", "-q", "-m", "pr");
  return spawnSync(process.execPath, [tsx, script], { cwd: dir, env: { ...process.env, HG_BASE: "HEAD~1" }, encoding: "utf8" });
}

const spec = (plan: string) => `# 0009 Example\n## Acceptance criteria\n- [x.y] Something.\n## Plan\n${plan}\n## Assumptions\n- None.\n`;

describe("check-plan failure modes", () => {
  it("passes a plan that lists several failure modes of the touched flow", () => {
    const r = checkPlan({
      "0009-ok.md": spec(
        "- Touches pantry.\n- Failure modes of pantry low stock to shopping list:\n  - pantry empty: list shows the empty state.\n  - capability errors: list shows the error state.",
      ),
    });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  it("rejects a plan without a failure-mode list", () => {
    const r = checkPlan({ "0009-none.md": spec("- Touches pantry.") });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('plan needs a "- Failure modes of <flow>:" list');
  });

  it("rejects a symptom-only plan with a single failure mode", () => {
    const r = checkPlan({
      "0009-one.md": spec("- Failure modes of checkout:\n  - button does nothing: add the handler.\n- Touches shopping-list."),
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("fewer than two entries");
  });

  it("ignores failure modes listed outside the plan section", () => {
    const r = checkPlan({ "0009-outside.md": `${spec("- Touches pantry.")}- Failure modes of x:\n  - a: b.\n  - c: d.\n` });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('plan needs a "- Failure modes of <flow>:" list');
  });

  it("checks every changed spec on its own", () => {
    const ok = spec("- Failure modes of x:\n  - a: b.\n  - c: d.");
    const r = checkPlan({ "0009-ok.md": ok, "0010-none.md": spec("- Touches pantry.") });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("docs/specs/0010-none.md");
    expect(r.stderr).not.toContain("docs/specs/0009-ok.md");
  });
});
