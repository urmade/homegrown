import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Run = { name: string; status: string; conclusion: string | null; started_at: string };
const run = (name: string, conclusion: string | null, started_at = "2026-10-18T10:00:00Z"): Run => ({
  name,
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  started_at,
});
const allGreen = ["static", "db", "e2e", "docker-arm64"].map((n) => run(n, "success"));

function gate(runs: Run[]) {
  const r = spawnSync("bash", ["tools/harness/merge-gate.sh", "abc123", "0"], {
    env: { ...process.env, CHECK_RUNS_JSON: JSON.stringify({ check_runs: runs }), MERGE_GATE_INTERVAL: "0" },
    encoding: "utf8",
  });
  return { code: r.status, out: r.stdout };
}

describe("merge gate", () => {
  it("harness.merge-gate.green passes only when every required check succeeded", () => {
    expect(gate([...allGreen, run("drift", "failure"), run("enable", null)]).code).toBe(0);
  });

  it("harness.merge-gate.red never merges when a required check failed or was cancelled", () => {
    expect(gate([...allGreen.slice(1), run("static", "failure")]).code).toBe(2);
    expect(gate([...allGreen.slice(1), run("static", "cancelled")]).code).toBe(2);
  });

  it("harness.merge-gate.pending-missing waits and then gives up without merging", () => {
    expect(gate([...allGreen.slice(1), run("static", null)]).code).toBe(3);
    expect(gate(allGreen.slice(1)).code).toBe(3);
    expect(gate([]).code).toBe(3);
  });

  it("harness.merge-gate.latest uses the newest run of each check (re-runs count, old greens do not)", () => {
    const rerunGreen = [...allGreen.slice(1), run("static", "failure"), run("static", "success", "2026-10-18T11:00:00Z")];
    expect(gate(rerunGreen).code).toBe(0);
    const rerunRed = [...allGreen, run("e2e", "failure", "2026-10-18T11:00:00Z")];
    expect(gate(rerunRed).code).toBe(2);
  });
});
