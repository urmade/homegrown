import { expect, it } from "vitest";

// Throwaway pipeline proof: fails on the first CI attempt of this PR only; removed right after the proof.
it("demo.flaky fails on the first CI attempt of its own PR only", () => {
  expect(process.env.GITHUB_RUN_ATTEMPT === "1" && process.env.GITHUB_HEAD_REF === "cursor/demo-flaky-9b91").toBe(false);
});
