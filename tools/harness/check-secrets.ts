import { existsSync, readFileSync } from "node:fs";
import { addedLines, done, fail } from "./lib";

/** Secret scan over added lines and the PR body (where run records live). */
const PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "JWT"],
  [/\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i, "hard-coded credential"],
  [/postgres(ql)?:\/\/[^:\s/]+:(?!\$\{)[^@\s]{12,}@/, "database URL with password"],
];

const scan = (where: string, text: string) => {
  for (const [re, what] of PATTERNS) if (re.test(text)) fail(`${where}: looks like a ${what}`);
};

for (const { path, line } of addedLines()) if (!path.endsWith("pnpm-lock.yaml")) scan(path, line);
const event = process.env.GITHUB_EVENT_PATH;
if (event && existsSync(event)) scan("PR body", (JSON.parse(readFileSync(event, "utf8")) as { pull_request?: { body?: string } }).pull_request?.body ?? "");
done("check-secrets");
