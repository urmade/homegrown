import { addedLines, changedFiles, done, fail, git, baseRef, warn } from "./lib";

/** Test integrity: no new skip/only/todo/fixme; deleted tests and removed assertions are flagged for the reviewer. */
const TEST = /\.(test|spec)\.tsx?$/;
for (const { path, line } of addedLines().filter((l) => TEST.test(l.path)))
  if (/\b(it|test|describe)\s*\.\s*(skip|only|todo|fixme)\b|\b(xit|xdescribe|fit|fdescribe)\s*\(/.test(line))
    fail(`${path}: new skip/only/todo is not allowed: "${line.trim()}"`);

for (const { path, status } of changedFiles().filter((c) => TEST.test(c.path)))
  if (status === "D") warn(`${path}: test file deleted; justify it in the spec`);

const diff = git("diff", "--unified=0", baseRef(), "--", "*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx");
const removed = (diff.match(/^-(?!--).*\bexpect\(/gm) ?? []).length;
const added = (diff.match(/^\+(?!\+\+).*\bexpect\(/gm) ?? []).length;
if (removed > added) warn(`${removed - added} assertion(s) removed net; justify weakened tests in the spec`);
done("check-tests");
