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

function migrateFail(message: string, stderr: string) {
  return Object.assign(new Error(message), { stderr, stdout: "" });
}

function fakeIO(
  prodHealthy: boolean,
  stagingFails: boolean | Error = false,
  openReverts: { number: number; head: { ref: string } }[] = [],
) {
  const calls = {
    git: [] as string[][],
    compose: [] as string[][],
    sql: [] as { text: string; params?: unknown[] }[],
    github: [] as { path: string; body?: string }[],
    dumps: [] as string[],
  };
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
    sql: async <T>(text: string, params?: unknown[]) => {
      calls.sql.push({ text, params });
      return (text.includes("from logs.logs") ? [{ msg: "fn.failed", error: "boom in pantry.listItems" }] : []) as T[];
    },
    healthy: async () => prodHealthy,
    github: async (path: string, init?: RequestInit) => {
      calls.github.push({ path, body: init?.body as string | undefined });
      if (path.startsWith("/commits/") && path.endsWith("/pulls") && !init?.method) return [{ number: 7 }];
      if (path.startsWith("/pulls?") && !init?.method) return openReverts;
      return {};
    },
    dump: (label: string) => {
      calls.dumps.push(label);
      return `${label}.dump`;
    },
    rehearse: async () => {
      if (stagingFails instanceof Error) throw stagingFails;
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

  it("deploy.staging-error-tail staging_failed and stdout keep the migrate file and Postgres message", async () => {
    const password = ["s3cret", "PW"].join("");
    const url = `postgres://postgres:${password}@db:5432/homegrown_staging`;
    const pad = "x".repeat(400);
    const thrown = migrateFail(
      `Command failed: docker compose run --rm -e MIGRATE_DATABASE_URL=${url} migrate\n${pad}`,
      "shopping-list/0002_lists.sql: permission denied for schema shopping_list\n    at migrate.ts:75",
    );
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      writes.push(String(chunk));
      return (orig as (c: unknown, ...r: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;
    const { io, calls } = fakeIO(true, thrown);
    try {
      expect(await deploy("eee5555ddd", PREV, io)).toBe(false);
    } finally {
      process.stdout.write = orig;
    }
    const event = calls.sql.find((q) => q.params?.[0] === "staging_failed");
    const detail = event?.params?.[2] as { error?: string };
    const logged = writes.join("\n");
    expect(detail?.error).toContain("shopping-list/0002_lists.sql");
    expect(detail?.error).toContain("permission denied for schema shopping_list");
    expect(logged).toContain("shopping-list/0002_lists.sql");
    expect(logged).toContain("permission denied for schema shopping_list");
  });

  it("deploy.redact-credentials command errors drop URL passwords and tokens before events and stdout", async () => {
    const password = ["s3cret", "PW"].join("");
    const token = "ghp_" + "a".repeat(36);
    process.env.POSTGRES_PASSWORD = password;
    process.env.GITHUB_TOKEN = token;
    const url = `postgres://postgres:${password}@db:5432/homegrown_staging`;
    const thrown = migrateFail(
      `Command failed: docker compose run --rm -e MIGRATE_DATABASE_URL=${url} git https://x-access-token:${token}@github.com/household/homegrown.git migrate`,
      `connection to ${url} failed; token ${token}`,
    );
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      writes.push(String(chunk));
      return (orig as (c: unknown, ...r: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;
    const { io, calls } = fakeIO(true, thrown);
    try {
      expect(await deploy("eee5555ddd", PREV, io)).toBe(false);
    } finally {
      process.stdout.write = orig;
      process.env.GITHUB_TOKEN = "test-token";
      delete process.env.POSTGRES_PASSWORD;
    }
    const event = calls.sql.find((q) => q.params?.[0] === "staging_failed");
    const text = `${JSON.stringify(event?.params?.[2])}\n${writes.join("\n")}`;
    expect(text).not.toContain(password);
    expect(text).not.toContain(token);
    expect(text).not.toMatch(/postgres(?:ql)?:\/\/[^:\s/]+:[^@*\s]+@/);
  });

  it("deploy.revert-restores-checkout leaves the repo on the deploy SHA after revert success or failure", async () => {
    const SHA = "eee5555ddd";
    const { io, calls } = fakeIO(true, true);
    expect(await deploy(SHA, PREV, io)).toBe(false);
    const checkouts = calls.git.filter((a) => a.includes("checkout"));
    expect(checkouts.at(-1)).toEqual(["checkout", "--quiet", "--detach", SHA]);

    const failing = fakeIO(true, true);
    failing.io.git = (...args: string[]) => {
      failing.calls.git.push(args);
      if (args[0] === "commit") throw new Error("commit failed");
      if (args[0] === "diff") return "diff --git a/x b/x";
      if (args[0] === "show") return "# owners\n/AGENTS.md  @o\n/tools/harness/  @o\n";
      return "";
    };
    expect(await deploy(SHA, PREV, failing.io)).toBe(false);
    expect(failing.calls.git.filter((a) => a.includes("checkout")).at(-1)).toEqual(["checkout", "--quiet", "--detach", SHA]);
  });

  it("deploy.revert-closes-superseded opening a revert PR closes older open revert/* PRs only", async () => {
    const SHA = "eee5555ddd";
    const { io, calls } = fakeIO(true, true, [
      { number: 101, head: { ref: "revert/aaaaaaa" } },
      { number: 102, head: { ref: "feat/other" } },
      { number: 103, head: { ref: "revert/eee5555" } },
    ]);
    expect(await deploy(SHA, PREV, io)).toBe(false);
    expect(calls.github.find((g) => g.path === "/pulls/101")?.body).toContain('"state":"closed"');
    expect(calls.github.some((g) => g.path === "/pulls/102")).toBe(false);
    expect(calls.github.some((g) => g.path === "/pulls/103")).toBe(false);
  });
});
