# homegrown

A self-hosted household app you fork and run on your own NAS. Pre-built agentic harness to let agents build out the features you actually want in your home setup.

It starts as an empty, installable PWA in English or German (asked on first start; each member can override it in Settings). Features (shopping list, meal plan, calendar…) arrive as modules that Cursor cloud agents build on request; CI, branch protection and the database enforce the rules, so nobody has to read feature PRs. The only human approval is review of harness changes (see `.github/CODEOWNERS`).

## Run it on the NAS

Requirements: Docker with Compose (arm64 or amd64).

```sh
cp .env.example .env            # set POSTGRES_PASSWORD and APP_DB_PASSWORD
docker compose up -d            # db, one-shot migrate, app on :3000 (LAN only)
```

Pull-based deploys (no inbound API): set `GITHUB_REPO` and `GITHUB_TOKEN` in `.env`, then

```sh
docker compose --profile deploy up -d deploy-agent
```

The deploy agent polls `main` every 60 s, deploys only SHAs whose checks are green, honours the pause switch on `/admin`, rehearses migrations on staging restored from the latest dump, dumps before promote, smoke-tests `/health`, and rolls back on red, pushes a `revert/<sha>` branch with a revert PR, and posts the error logs to the PR. Nightly: whole-DB dump (logs excluded), rotation (7 daily, 4 weekly), 14-day log retention. Backups go to `HG_BACKUP_DIR`; point that at your sync target.

## Layout

- `apps/web`: the Next.js shell and admin pages (`/admin`, `/admin/logs`, `/admin/data-flow`)
- `apps/<module>`: feature modules, each with `module.json`, its own Postgres schema and role
- `core/`: vendored platform (ctx.db, ctx.log, auth, migrations, PWA, data-flow); read-only in forks
- `packages/ui`, `packages/deploy-agent`
- `AGENTS.md`, `.cursor/`, `tools/harness/`, `.github/`: the agent harness

## Develop

```sh
pnpm install && pnpm gen
export MIGRATE_DATABASE_URL=postgres://postgres:postgres@localhost:5432/homegrown
export APP_DB_PASSWORD=app DATABASE_URL=postgres://homegrown_app:app@localhost:5432/homegrown
pnpm migrate && pnpm dev
```

See `AGENTS.md` for tests, checks and the module contract.
