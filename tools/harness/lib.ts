import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "pipe"] }).trim();

/** PR base in CI (GITHUB_BASE_REF), HG_BASE locally, previous commit on main pushes. */
export function baseRef(): string {
  const ref = process.env.HG_BASE ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "HEAD~1");
  try {
    return git("merge-base", ref, "HEAD");
  } catch {
    return ref;
  }
}

export type Change = { status: string; path: string };

export function changedFiles(base = baseRef()): Change[] {
  const out = git("diff", "--name-status", "--no-renames", base);
  return out ? out.split("\n").map((l) => ({ status: l[0]!, path: l.split("\t")[1]! })) : [];
}

export function addedLines(base = baseRef(), paths: string[] = []): { path: string; line: string }[] {
  const out = git("diff", "--unified=0", "--no-renames", base, "--", ...paths);
  const lines: { path: string; line: string }[] = [];
  let path = "";
  for (const l of out.split("\n")) {
    if (l.startsWith("+++ ")) path = l.slice(6);
    else if (l.startsWith("+") && !l.startsWith("+++")) lines.push({ path, line: l.slice(1) });
  }
  return lines;
}

export const showAtBase = (path: string, base = baseRef()): string | null => {
  try {
    return git("show", `${base}:${path}`);
  } catch {
    return null;
  }
};

export const read = (path: string) => readFileSync(path, "utf8");

export const HARNESS_PATHS = [/^AGENTS\.md$/, /^\.cursor\/(rules|skills|agents|hooks)\//, /^\.cursor\/hooks\.json$/, /^\.github\//, /^tools\/harness\//, /^harness\.lock\.json$/];
export const isHarness = (p: string) => HARNESS_PATHS.some((r) => r.test(p));

let failed = false;
export function fail(msg: string) {
  failed = true;
  process.stderr.write(`::error::${msg}\n`);
}
export function warn(msg: string) {
  process.stdout.write(`::warning::${msg}\n`);
}
export function done(name: string) {
  if (failed) {
    process.stderr.write(`${name}: FAILED\n`);
    process.exit(1);
  }
  process.stdout.write(`${name}: ok\n`);
}
