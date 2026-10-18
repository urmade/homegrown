import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

/**
 * Pull-based deploys on the NAS: poll main every 60 s, deploy only green SHAs, honour pause_deploys,
 * rehearse on staging restored from the latest dump, dump before promote, smoke, and on red prod
 * roll back the image, open a revert PR for the merge on main and report the SHA's error logs.
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

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = [], db = "homegrown"): Promise<T[]> {
  const c = new pg.Client({ connectionString: ownerUrl(db) });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
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

async function healthy(base: string, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (res?.ok) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

/** Everything a deploy touches outside this process; tests replace it. */
export type IO = {
  git: (...args: string[]) => string;
  compose: (tag: string, ...args: string[]) => string;
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[], db?: string) => Promise<T[]>;
  healthy: (base: string) => Promise<boolean>;
  github: (path: string, init?: RequestInit) => Promise<unknown>;
  dump: (label: string) => string;
  rehearse: (sha: string) => Promise<void>;
};

const io: IO = {
  git: (...args) => run("git", args),
  compose: (tag, ...args) => run("docker", ["compose", ...args], { HG_TAG: tag }),
  sql,
  healthy,
  github,
  dump,
  rehearse,
};

const event = (x: IO, kind: string, sha: string, detail: Record<string, unknown> = {}) =>
  x.sql("insert into core.events (kind, sha, detail) values ($1, $2, $3)", [kind, sha, detail]).catch(() => []);

async function report(x: IO, sha: string, ok: boolean, text: string) {
  if (!env.GITHUB_TOKEN) return;
  await x.github(`/statuses/${sha}`, { method: "POST", body: JSON.stringify({ state: ok ? "success" : "failure", context: "homegrown/deploy", description: text.slice(0, 140) }) });
  const prs = ((await x.github(`/commits/${sha}/pulls`)) as { number: number }[] | null) ?? [];
  for (const pr of prs) await x.github(`/issues/${pr.number}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
}

/**
 * Reverts the red commit on top of current main and pushes it as revert/<sha>. With GitHub configured it
 * opens a PR, which auto-merges on green like any non-harness change; main is never pushed to directly.
 */
async function revertOnMain(x: IO, sha: string): Promise<string | null> {
  const branch = `revert/${sha.slice(0, 7)}`;
  const remote = env.GITHUB_REPO && env.GITHUB_TOKEN ? `https://x-access-token:${env.GITHUB_TOKEN}@github.com/${env.GITHUB_REPO}.git` : "origin";
  try {
    x.git("fetch", "--quiet", "origin", "main");
    x.git("checkout", "--quiet", "--detach", "origin/main");
    const isMerge = x.git("rev-list", "--parents", "-n", "1", sha).split(" ").length > 2;
    x.git("revert", "--no-commit", ...(isMerge ? ["-m", "1"] : []), sha);
    // Migrations stay: the schema is already applied and N-1 keeps the previous code compatible with it,
    // and check-migrations rejects deleting applied migrations, which would leave the revert PR red forever.
    const migrations = x.git("ls-tree", "-r", "--name-only", sha).split("\n").filter((f) => /(^|\/)migrations\/[^/]+\.sql$/.test(f));
    if (migrations.length) x.git("checkout", sha, "--", ...migrations);
    x.git("-c", "user.name=homegrown-deploy-agent", "-c", "user.email=deploy-agent@homegrown.invalid", "commit", "--no-verify", "-m", `Revert ${sha.slice(0, 7)} (red deploy; migrations kept)`);
    x.git("push", "--quiet", remote, `HEAD:refs/heads/${branch}`);
  } catch (e) {
    for (const cleanup of [["revert", "--abort"], ["reset", "--hard", "--quiet"]])
      try {
        x.git(...cleanup);
      } catch {}
    say("revert.failed", { sha, error: String(e).slice(0, 300) });
    return null;
  }
  await x.github("/pulls", {
    method: "POST",
    body: JSON.stringify({ title: `Revert ${sha.slice(0, 7)}: red deploy`, head: branch, base: "main", body: `The deploy of ${sha} failed (staging rehearsal or prod smoke); prod runs the previous version. This revert keeps migrations and goes through the normal merge gate. Fix forward on a branch.` }),
  });
  return branch;
}

export async function deploy(sha: string, prev: string, x: IO = io): Promise<boolean> {
  say("deploy.start", { sha, prev });
  x.git("checkout", "--detach", sha);
  x.compose(sha, "build", "migrate");
  try {
    await x.rehearse(sha);
  } catch (e) {
    const revert = await revertOnMain(x, sha);
    await event(x, "staging_failed", sha, { error: String(e).slice(0, 500), revert });
    await report(x, sha, false, `Staging rehearsal failed for ${sha.slice(0, 7)}; prod untouched. ${revert ? `Revert pushed to \`${revert}\`.` : "Revert the merge manually."}`);
    return false;
  }
  x.dump("pre-promote");
  x.compose(sha, "run", "--rm", "migrate");
  x.compose(sha, "up", "-d", "--no-deps", "app");
  if (await x.healthy("http://app:3000")) {
    writeFileSync(STATE, sha);
    await event(x, "deploy", sha, { prev });
    await report(x, sha, true, `Deployed ${sha.slice(0, 7)}; prod smoke green.`);
    return true;
  }

  // Red prod: the schema stays (N-1 keeps the previous image compatible), only the image goes back.
  x.compose(prev, "up", "-d", "--no-deps", "app");
  const revert = await revertOnMain(x, sha);
  await event(x, "rollback", sha, { to: prev, revert });
  const errors = await x
    .sql<{ msg: string; error: string | null }>(
      "select msg, data->>'error' as error from logs.logs where sha = $1 and level = 'error' order by ts desc limit 20",
      [sha],
    )
    .catch(() => []);
  await report(
    x,
    sha,
    false,
    [
      `Prod smoke failed for ${sha.slice(0, 7)}; rolled back to ${prev.slice(0, 7)}. ${revert ? `Revert pushed to \`${revert}\`.` : "Revert the merge manually."} Fix forward on a branch.`,
      "",
      "Error logs for this SHA:",
      "```",
      ...errors.map((e) => `${e.msg}: ${e.error ?? ""}`),
      "```",
    ].join("\n"),
  );
  return false;
}

type CiRun = { status: string; conclusion: string | null; event?: string; triggering_actor?: { login: string }; run_started_at?: string; created_at: string };
const executed = (r: CiRun) => r.conclusion !== "action_required" && !(r.event === "pull_request" && r.triggering_actor?.login === "github-actions[bot]");

/** Same rule as tools/harness/merge-gate.sh: the most recently started ci.yml run for the SHA completed with success. */
export async function isGreen(sha: string, gh: IO["github"] = github): Promise<boolean> {
  if (!env.GITHUB_REPO) return env.HG_ALLOW_UNVERIFIED === "1";
  const data = (await gh(`/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`)) as { workflow_runs: CiRun[] } | null;
  const latest = (data?.workflow_runs ?? []).filter(executed).sort((a, b) => (a.run_started_at ?? a.created_at).localeCompare(b.run_started_at ?? b.created_at)).at(-1);
  return latest?.status === "completed" && latest.conclusion === "success";
}

async function paused() {
  const rows = await sql<{ enabled: boolean }>("select enabled from core.flags where name = 'pause_deploys'").catch(() => []);
  return rows[0]?.enabled ?? false;
}

function dump(label: string, db = "homegrown") {
  const file = join(BACKUPS, `${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);
  // Log rows are excluded, not the logs schema: a restored database must still have logs.logs.
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

async function rehearse(sha: string) {
  const latest = latestDump();
  if (!latest) {
    say("staging.skipped", { reason: "no dump yet" });
    return;
  }
  await sql("drop database if exists homegrown_staging with (force)", [], "postgres");
  await sql("create database homegrown_staging", [], "postgres");
  run("pg_restore", ["--no-owner", "--role=postgres", "-d", ownerUrl("homegrown_staging"), join(BACKUPS, latest)]);
  io.compose(sha, "run", "--rm", "-e", `MIGRATE_DATABASE_URL=${ownerUrl("homegrown_staging")}`, "migrate");
  io.compose(sha, "--profile", "staging", "up", "-d", "--no-deps", "app-staging");
  try {
    if (!(await healthy("http://app-staging:3000"))) throw new Error("staging smoke failed");
  } finally {
    io.compose(sha, "--profile", "staging", "rm", "-sf", "app-staging");
  }
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

// Persisted so a restart never re-deploys a SHA that already failed (and never pushes its revert twice).
const FAILED = join(BACKUPS, ".failed");
const failed = new Set(existsSync(FAILED) ? readFileSync(FAILED, "utf8").split("\n").filter(Boolean) : []);
async function tick() {
  await nightly();
  run("git", ["fetch", "--quiet", "origin", "main"]);
  const sha = run("git", ["rev-parse", "origin/main"]);
  const prev = existsSync(STATE) ? readFileSync(STATE, "utf8").trim() : "local";
  if (sha === prev || failed.has(sha)) return;
  if (await paused()) return say("deploy.paused", { sha });
  if (!(await isGreen(sha))) return say("deploy.waiting_for_green", { sha });
  if (!(await deploy(sha, prev))) {
    failed.add(sha);
    writeFileSync(FAILED, [...failed].join("\n"));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (;;) {
    await tick().catch((e) => say("tick.failed", { error: String(e).slice(0, 500) }));
    if (env.HG_ONCE === "1") break;
    await new Promise((r) => setTimeout(r, 60_000));
  }
}
