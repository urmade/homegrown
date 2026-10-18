import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Pull-based deploys on the NAS: poll main every 60 s, deploy only green SHAs, honour pause_deploys,
 * rehearse on staging restored from the latest dump, dump before promote, smoke, roll back on red.
 * There is no inbound API.
 */
const env = process.env;
const REPO = env.HG_REPO ?? "/repo";
const BACKUPS = env.HG_BACKUPS ?? "/backups";
const STATE = join(BACKUPS, ".deployed");
const ownerUrl = (db = "homegrown") => `postgres://postgres:${env.POSTGRES_PASSWORD}@db:5432/${db}`;

const say = (msg: string, data: Record<string, unknown> = {}) =>
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level: "info", module: "deploy-agent", msg, ...data })}\n`);

const run = (cmd: string, args: string[], extra: Record<string, string> = {}) =>
  execFileSync(cmd, args, { cwd: REPO, encoding: "utf8", env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).trim();
const compose = (tag: string, ...args: string[]) => run("docker", ["compose", ...args], { HG_TAG: tag });

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = [], db = "homegrown"): Promise<T[]> {
  const c = new pg.Client({ connectionString: ownerUrl(db) });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const event = (kind: string, sha: string, detail: Record<string, unknown> = {}) =>
  sql("insert into core.events (kind, sha, detail) values ($1, $2, $3)", [kind, sha, detail]).catch(() => {});

async function paused() {
  const rows = await sql<{ enabled: boolean }>("select enabled from core.flags where name = 'pause_deploys'").catch(() => []);
  return rows[0]?.enabled ?? false;
}

async function github(path: string, init: RequestInit = {}) {
  if (!env.GITHUB_REPO) return null;
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: { accept: "application/vnd.github+json", ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}), ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? res.json() : null;
}

async function isGreen(sha: string) {
  if (!env.GITHUB_REPO) return env.HG_ALLOW_UNVERIFIED === "1";
  const data = (await github(`/commits/${sha}/check-runs?per_page=100`)) as { check_runs: { status: string; conclusion: string | null }[] } | null;
  const runs = data?.check_runs ?? [];
  return runs.length > 0 && runs.every((r) => r.status === "completed" && ["success", "skipped", "neutral"].includes(r.conclusion ?? ""));
}

async function report(sha: string, ok: boolean, text: string) {
  if (!env.GITHUB_TOKEN) return;
  await github(`/statuses/${sha}`, { method: "POST", body: JSON.stringify({ state: ok ? "success" : "failure", context: "homegrown/deploy", description: text.slice(0, 140) }) });
  const prs = ((await github(`/commits/${sha}/pulls`)) as { number: number }[] | null) ?? [];
  for (const pr of prs) await github(`/issues/${pr.number}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
}

function dump(label: string, db = "homegrown") {
  const file = join(BACKUPS, `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  run("pg_dump", ["-Fc", "--exclude-table-data=logs.*", "-f", file, ownerUrl(db)]);
  return file;
}

function rotate() {
  const keep: Record<string, number> = { daily: 7, weekly: 4, "pre-promote": 10 };
  for (const [label, n] of Object.entries(keep)) {
    const files = readdirSync(BACKUPS).filter((f) => f.startsWith(`${label}-`)).sort().reverse();
    for (const f of files.slice(n)) unlinkSync(join(BACKUPS, f));
  }
}

function latestDump() {
  const files = readdirSync(BACKUPS).filter((f) => f.endsWith(".dump"));
  return files.sort((a, b) => statSync(join(BACKUPS, b)).mtimeMs - statSync(join(BACKUPS, a)).mtimeMs)[0];
}

async function healthy(base: string, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (res?.ok) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function rehearse(sha: string) {
  const latest = latestDump();
  if (!latest) return say("staging.skipped", { reason: "no dump yet" });
  await sql("drop database if exists homegrown_staging with (force)", [], "postgres");
  await sql("create database homegrown_staging", [], "postgres");
  run("pg_restore", ["--no-owner", "--role=postgres", "-d", ownerUrl("homegrown_staging"), join(BACKUPS, latest)]);
  compose(sha, "run", "--rm", "-e", `MIGRATE_DATABASE_URL=${ownerUrl("homegrown_staging")}`, "migrate");
  compose(sha, "--profile", "staging", "up", "-d", "--no-deps", "app-staging");
  try {
    if (!(await healthy("http://app-staging:3000"))) throw new Error("staging smoke failed");
  } finally {
    compose(sha, "--profile", "staging", "rm", "-sf", "app-staging");
  }
}

async function deploy(sha: string, prev: string) {
  say("deploy.start", { sha, prev });
  run("git", ["checkout", "--detach", sha]);
  compose(sha, "build", "migrate");
  try {
    await rehearse(sha);
  } catch (e) {
    await event("staging_failed", sha, { error: String(e).slice(0, 500) });
    await report(sha, false, `Staging rehearsal failed for ${sha.slice(0, 7)}; prod untouched.`);
    return false;
  }
  dump("pre-promote");
  compose(sha, "run", "--rm", "migrate");
  compose(sha, "up", "-d", "--no-deps", "app");
  if (await healthy("http://app:3000")) {
    writeFileSync(STATE, sha);
    await event("deploy", sha, { prev });
    await report(sha, true, `Deployed ${sha.slice(0, 7)}; prod smoke green.`);
    return true;
  }
  compose(prev, "up", "-d", "--no-deps", "app");
  await event("rollback", sha, { to: prev });
  const errors = await sql<{ msg: string; error: string }>(
    "select msg, data->>'error' as error from logs.logs where sha = $1 and level = 'error' order by ts desc limit 20",
    [sha],
  ).catch(() => []);
  await report(
    sha,
    false,
    [`Prod smoke failed for ${sha.slice(0, 7)}; rolled back to ${prev.slice(0, 7)}. Revert the merge, then fix forward.`, "", "Error logs for this SHA:", "```", ...errors.map((e) => `${e.msg}: ${e.error ?? ""}`), "```"].join("\n"),
  );
  return false;
}

let lastNightly = "";
async function nightly() {
  const today = new Date().toISOString().slice(0, 10);
  if (new Date().getHours() !== 3 || lastNightly === today) return;
  lastNightly = today;
  dump(new Date().getDay() === 0 ? "weekly" : "daily");
  rotate();
  await sql("delete from logs.logs where ts < now() - interval '14 days'");
  say("nightly.done");
}

const failed = new Set<string>();
async function tick() {
  await nightly();
  run("git", ["fetch", "--quiet", "origin", "main"]);
  const sha = run("git", ["rev-parse", "origin/main"]);
  const prev = existsSync(STATE) ? readFileSync(STATE, "utf8").trim() : "local";
  if (sha === prev || failed.has(sha)) return;
  if (await paused()) return say("deploy.paused", { sha });
  if (!(await isGreen(sha))) return say("deploy.waiting_for_green", { sha });
  if (!(await deploy(sha, prev))) failed.add(sha);
}

for (;;) {
  await tick().catch((e) => say("tick.failed", { error: String(e).slice(0, 500) }));
  if (env.HG_ONCE === "1") break;
  await new Promise((r) => setTimeout(r, 60_000));
}
