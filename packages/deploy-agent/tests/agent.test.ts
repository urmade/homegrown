import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const backups = mkdtempSync(join(tmpdir(), "hg-backups-"));
process.env.HG_BACKUPS = backups;
process.env.GITHUB_REPO = "household/homegrown";
process.env.GITHUB_TOKEN = "test-token";
const { deploy, isGreen } = await import("../src/agent");

const SHA = "abc1234def5678";
const PREV = "0001111222333444555666777888999aaabbbccc";

function fakeIO(prodHealthy: boolean, stagingFails = false) {
  const calls = { git: [] as string[][], compose: [] as string[][], sql: [] as { text: string; params?: unknown[] }[], github: [] as { path: string; body?: string }[], dumps: [] as string[] };
  const io = {
    git: (...args: string[]) => {
      calls.git.push(args);
      if (args[0] === "diff") return "diff --git a/x b/x";
      if (args[0] === "show") return "# owners\n/AGENTS.md  @o\n/tools/harness/  @o\n";
      return "";
    },
    compose: (tag: string, ...args: string[]) => {
      calls.compose.push([tag, ...args]);
      return "";
    },
    sql: async <T,>(text: string, params?: unknown[]) => {
      calls.sql.push({ text, params });
      return (text.includes("from logs.logs") ? [{ msg: "fn.failed", error: "boom in pantry.listItems" }] : []) as T[];
    },
    healthy: async () => prodHealthy,
    github: async (path: string, init?: RequestInit) => {
      calls.github.push({ path, body: init?.body as string | undefined });
      return path.endsWith("/pulls") && !init ? [{ number: 7 }] : {};
    },
    dump: (label: string) => {
      calls.dumps.push(label);
      return `${label}.dump`;
    },
    rehearse: async () => {
      if (stagingFails) throw new Error("staging smoke failed");
    },
  };
  return { io, calls };
}

describe("deploy agent", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  it("deploy.promote-green records the deploy after a green prod smoke", async () => {
    const { io, calls } = fakeIO(true);
    expect(await deploy(SHA, PREV, io)).toBe(true);
    expect(calls.dumps).toEqual(["pre-promote"]);
    expect(calls.compose).toContainEqual([SHA, "run", "--rm", "migrate"]);
    expect(readFileSync(join(backups, ".deployed"), "utf8")).toBe(SHA);
    expect(calls.git.some((a) => a[0]?.includes("revert") || a.includes("revert"))).toBe(false);
  });

  it("deploy.rollback-after-promote restores the previous image, pushes a revert of the merge and reports the SHA's error logs", async () => {
    const SHA = "fff9999eee";
    const { io, calls } = fakeIO(false);
    const stateBefore = existsSync(join(backups, ".deployed")) ? readFileSync(join(backups, ".deployed"), "utf8") : null;
    expect(await deploy(SHA, PREV, io)).toBe(false);

    const promote = calls.compose.findIndex((c) => c[0] === SHA && c.includes("app") && c.includes("up"));
    const rollback = calls.compose.findIndex((c) => c[0] === PREV && c.join(" ") === `${PREV} up -d --no-deps app`);
    expect(promote).toBeGreaterThan(-1);
    expect(rollback).toBeGreaterThan(promote);

    // The whole undeployed range is reverted on top of current main, migrations excluded.
    expect(calls.git).toContainEqual(["checkout", "--quiet", "--detach", "origin/main"]);
    expect(calls.git).toContainEqual(["diff", "--binary", SHA, PREV, "--", ".", ":(exclude,glob)**/migrations/**", ":(exclude)packages/deploy-agent/", ":(exclude)AGENTS.md", ":(exclude)tools/harness/"]);
    expect(calls.git.find((a) => a[0] === "apply")?.slice(0, 3)).toEqual(["apply", "--index", "--3way"]);
    expect(calls.git).toContainEqual(["push", "--quiet", "https://x-access-token:test-token@github.com/household/homegrown.git", "HEAD:refs/heads/revert/fff9999"]);
    expect(calls.github.find((g) => g.path === "/pulls" && g.body)?.body).toContain('"head":"revert/fff9999"');

    const event = calls.sql.find((q) => q.text.startsWith("insert into core.events") && q.params?.[0] === "rollback");
    expect(event?.params).toEqual(["rollback", SHA, { to: PREV, revert: "revert/fff9999" }]);
    const comment = calls.github.find((g) => g.path === "/issues/7/comments");
    expect(comment?.body).toContain("boom in pantry.listItems");
    expect(calls.github).toContainEqual(expect.objectContaining({ path: `/statuses/${SHA}`, body: expect.stringContaining('"state":"failure"') }));
    expect(existsSync(join(backups, ".deployed")) ? readFileSync(join(backups, ".deployed"), "utf8") : null).toBe(stateBefore);
  });

  it("deploy.staging-revert a failed staging rehearsal leaves prod untouched and pushes a revert of the merge", async () => {
    const SHA = "eee5555ddd";
    const { io, calls } = fakeIO(true, true);
    expect(await deploy(SHA, PREV, io)).toBe(false);
    expect(calls.compose.some((c) => c.includes("up"))).toBe(false);
    expect(calls.dumps).toEqual([]);
    expect(calls.git).toContainEqual(["push", "--quiet", "https://x-access-token:test-token@github.com/household/homegrown.git", "HEAD:refs/heads/revert/eee5555"]);
    const event = calls.sql.find((q) => q.params?.[0] === "staging_failed");
    expect(event?.params?.[2]).toMatchObject({ revert: "revert/eee5555" });
  });

  it("deploy.green-rule only the latest started ci.yml run decides; red, pending and missing are not green", async () => {
    const runs = (...r: [string, string | null, string][]) => async () => ({
      workflow_runs: r.map(([status, conclusion, run_started_at]) => ({ status, conclusion, run_started_at, created_at: run_started_at })),
    });
    expect(await isGreen("s", runs(["completed", "success", "2026-01-01T10:00:00Z"]))).toBe(true);
    expect(await isGreen("s", runs(["completed", "failure", "2026-01-01T10:00:00Z"]))).toBe(false);
    expect(await isGreen("s", runs(["in_progress", null, "2026-01-01T10:00:00Z"]))).toBe(false);
    expect(await isGreen("s", runs())).toBe(false);
    expect(await isGreen("s", async () => null)).toBe(false);
    expect(await isGreen("s", runs(["completed", "failure", "2026-01-01T10:00:00Z"], ["completed", "success", "2026-01-01T11:00:00Z"]))).toBe(true);
    expect(await isGreen("s", runs(["completed", "success", "2026-01-01T10:00:00Z"], ["completed", "cancelled", "2026-01-01T11:00:00Z"]))).toBe(false);
    expect(await isGreen("s", runs(["completed", "success", "2026-01-01T10:00:00Z"], ["completed", "action_required", "2026-01-01T11:00:00Z"]))).toBe(true);
  });
});
