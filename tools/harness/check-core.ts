import { changedFiles, done, fail, isHarness, read } from "./lib";

/** core/ is read-only outside the upstream repo and upgrade-core branches; harness and apps/ never change together. */
const files = changedFiles().map((c) => c.path);
const lock = JSON.parse(read("harness.lock.json")) as { upstream: string };
const branch = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? "";
const upstream = process.env.GITHUB_REPOSITORY === lock.upstream;

const core = files.filter((f) => f.startsWith("core/"));
if (core.length && !upstream && !branch.startsWith("upgrade-core/"))
  fail(`core/ is vendored and read-only; use the upgrade-core skill. Touched: ${core.join(", ")}`);

const harness = files.filter(isHarness);
const apps = files.filter((f) => f.startsWith("apps/"));
if (harness.length && apps.length)
  fail(`harness paths and apps/ changed in one PR; split it (harness: ${harness.slice(0, 3).join(", ")}; apps: ${apps.slice(0, 3).join(", ")})`);

done("check-core");
