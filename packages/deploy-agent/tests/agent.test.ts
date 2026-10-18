import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const backups = mkdtempSync(join(tmpdir(), "hg-backups-"));
process.env.HG_BACKUPS = backups;
process.env.GITHUB_REPO = "household/homegrown";
process.env.GITHUB_TOKEN = "test-token";
const { deploy } = await import("../src/agent");

const SHA = "abc1234def5678";
const PREV = "0001111222333";

function fakeIO(prodHealthy: boolean) {
  const calls = { git: [] as string[][], compose: [] as string[][], sql: [] as { text: string; params?: unknown[] }[], github: [] as { path: string; body?: string }[], dumps: [] as string[] };
  const io = {
    git: (...args: string[]) => {
      calls.git.push(args);
      return args[0] === "rev-list" ? `${args.at(-1)} parent1 parent2` : "";
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
    rehearse: async () => {},
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

    const revert = calls.git.find((a) => a.includes("revert"));
    expect(revert).toEqual(expect.arrayContaining(["revert", "--no-edit", "-m", "1", SHA]));
    expect(calls.git).toContainEqual(["push", "--quiet", "https://x-access-token:test-token@github.com/household/homegrown.git", "HEAD:refs/heads/revert/fff9999"]);
    expect(calls.github.find((g) => g.path === "/pulls" && g.body)?.body).toContain('"head":"revert/fff9999"');

    const event = calls.sql.find((q) => q.text.startsWith("insert into core.events") && q.params?.[0] === "rollback");
    expect(event?.params).toEqual(["rollback", SHA, { to: PREV, revert: "revert/fff9999" }]);
    const comment = calls.github.find((g) => g.path === "/issues/7/comments");
    expect(comment?.body).toContain("boom in pantry.listItems");
    expect(calls.github).toContainEqual(expect.objectContaining({ path: `/statuses/${SHA}`, body: expect.stringContaining('"state":"failure"') }));
    expect(existsSync(join(backups, ".deployed")) ? readFileSync(join(backups, ".deployed"), "utf8") : null).toBe(stateBefore);
  });
});
