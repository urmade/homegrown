import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type Run = { id: number; status: string; conclusion: string | null; run_attempt: number; run_started_at: string; created_at: string };
const run = (id: number, conclusion: string | null, started: string, attempt = 1): Run => ({
  id,
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
  run_attempt: attempt,
  run_started_at: started,
  created_at: "2026-10-18T09:00:00Z",
});

const gate = (runs: Run[]) =>
  spawnSync("bash", ["tools/harness/merge-gate.sh", "abc123"], {
    env: { ...process.env, CI_RUNS_JSON: JSON.stringify({ workflow_runs: runs }) },
    encoding: "utf8",
  }).stdout.trim();

describe("merge gate", () => {
  it("harness.merge-gate.green merges only on a completed, successful latest ci run", () => {
    expect(gate([run(1, "success", "2026-10-18T10:00:00Z")])).toBe("green");
  });

  it("harness.merge-gate.red reports failed, cancelled and timed-out runs with run id and attempt", () => {
    expect(gate([run(7, "failure", "2026-10-18T10:00:00Z")])).toBe("red 7 1");
    expect(gate([run(8, "cancelled", "2026-10-18T10:00:00Z", 2)])).toBe("red 8 2");
    expect(gate([run(9, "timed_out", "2026-10-18T10:00:00Z")])).toBe("red 9 1");
  });

  it("harness.merge-gate.pending-missing never merges while ci is running or absent", () => {
    expect(gate([run(1, null, "2026-10-18T10:00:00Z")])).toBe("pending");
    expect(gate([])).toBe("missing");
  });

  it("harness.merge-gate.latest the most recently started run (incl. a re-run attempt) decides", () => {
    expect(gate([run(1, "success", "2026-10-18T10:00:00Z"), run(2, "failure", "2026-10-18T11:00:00Z")])).toBe("red 2 1");
    expect(gate([run(2, "failure", "2026-10-18T10:00:00Z"), run(1, "success", "2026-10-18T12:00:00Z", 2)])).toBe("green");
    expect(gate([run(1, "success", "2026-10-18T10:00:00Z"), run(3, null, "2026-10-18T11:00:00Z")])).toBe("pending");
    expect(gate([run(1, "success", "2026-10-18T10:00:00Z"), run(4, "action_required", "2026-10-18T11:00:00Z")])).toBe("green");
    expect(gate([run(4, "action_required", "2026-10-18T11:00:00Z")])).toBe("missing");
  });
});
