# 0004 Staging rehearsal keeps module schema owners

Staging restore rewrites dump ownership to `postgres`, so a module migration that creates or alters objects in an already-existing schema fails when run as `hg_mod_<module>`. Same-cluster restore must keep the dump's owners so rehearsal matches prod. Command failures also store `MIGRATE_DATABASE_URL` (password) in `core.events` and stdout.

Port of household `urmade/homegrown-home#21` (`8a4200ec`), adapted to this repo. `core/src/log.ts` has the same leak class: `error` is a KEEP field, so URL passwords in exception messages reach every log sink.

## Acceptance criteria

- [deploy.staging-restore-owns-schema] Restoring a dump that already has a module schema, then applying a migration that creates a table in that schema and alters an existing table of that schema, succeeds (module role has CREATE/ownership, as on prod).
- [deploy.staging-error-tail] A failed staging migrate writes a `staging_failed` event and a stdout line whose error is the tail of migrate stderr (module/file and the Postgres message), not the start of the docker command line.
- [deploy.redact-credentials] Command failures never put a connection URL password, `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, or `GITHUB_TOKEN` into `core.events` or stdout.
- [core.log.redact-url-secrets] `ctx.log` redaction strips URL passwords and tokens from string values, including the KEEP `error` field, before any sink.
- [deploy.revert-restores-checkout] After `revertOnMain` (success or failure) the repo checkout is the deploy SHA, not the local revert commit.
- [deploy.revert-closes-superseded] Opening a new `revert/<sha>` PR closes older open `revert/*` PRs (not other PRs, not the new one).

Offline: no new routes; deploy-agent is NAS-side.

## Plan

- Touched: `packages/deploy-agent` (rehearse restore, error text, revert checkout, superseded revert PRs) and `core/src/log.ts` (value-level URL/token redaction on the existing `redact()` path). No module, table, capability, or dependency. Deploy-agent does not import core: the agent image copies only `packages/deploy-agent`, so the same small redaction lives in both places rather than a shared package. `core/src/migrate.ts` stays unchanged: `create schema if not exists … authorization` is correct for a first create; the bug is staging ownership, not the migrator.
- Failure modes of deploy (tick → green check → checkout → build → staging restore+migrate+smoke → pre-promote dump → prod migrate → prod smoke → revert) and of ctx.log (emit → redact → sinks):
  - Existing module schema/table after restore owned by `postgres`: drop `--no-owner --role=postgres` so `pg_restore` keeps dump owners (`deploy.staging-restore-owns-schema`). Same cluster, so those roles exist.
  - New module not in the dump: `create schema if not exists … authorization` still creates and owns; unchanged.
  - `ALTER TABLE` on a table the dump already had: table owner is preserved with schema owner; covered by the same restore test.
  - No dump yet: rehearsal still skips (`staging.skipped`); first promote has no restore path.
  - Staging migrate/smoke fails: prod is not migrated or restarted; revert branch is pushed (`deploy.staging-revert` already).
  - Staging error is `Command failed: docker compose …` sliced to 500 chars: store and log the stderr tail (`deploy.staging-error-tail`).
  - `MIGRATE_DATABASE_URL` / git remote token in `execFileSync` message: redact URLs and known secret env values before events and stdout (`deploy.redact-credentials`).
  - `pg_dump` / `pg_restore` / `git push` fail with the URL in the message: same redaction on every `run()` throw and on `tick.failed` / `revert.failed`.
  - `ctx.log.error` / `errorData` keep a URL password because `error` is a KEEP key: `redact()` also strips URL passwords and tokens from string values (`core.log.redact-url-secrets`).
  - Staging smoke timeout: still throws `staging smoke failed`; reason is logged; prod untouched.
  - Prod smoke fail: image rolled back; schema stays; revert + error-log comment unchanged.
  - `revertOnMain` leaves detached HEAD on the revert commit (`/repo` is the compose build context): `finally` checks out the deploy SHA (`deploy.revert-restores-checkout`).
  - Revert `git` fails mid-apply: existing `reset --hard`, then the same checkout restore, return null.
  - Stacked `revert/*` PRs from later main SHAs (each reverts `prev..sha`, they conflict): close older open `revert/*` when the new PR is created (`deploy.revert-closes-superseded`).
  - Close would take an unrelated PR: only `head.ref` starting with `revert/`, and never the branch just opened.
  - GitHub create PR fails (`github()` returns null): do not close older PRs; still return the pushed branch.
  - GitHub list/close fails: ignore; revert already pushed.
  - GitHub create throws (network): `finally` still restores checkout; exception is redacted on `tick.failed`.
  - Already-failed SHA: still recorded in `.failed`; revert push retried until the branch exists; checkout restore still runs.
  - `pause_deploys` / latest CI not green: unchanged skip.
  - `drop database homegrown_staging` while a session is open: still `with (force)`.
  - `app-staging` left running after a failed smoke: existing `finally` `rm -sf`.
  - Restore targeting prod by mistake: still only `homegrown_staging`; prod dump is read-only input.
  - Corrupt or empty dump: `pg_restore` throws, rehearsal fails, prod untouched, redacted tail logged.
  - `event()` insert fails: still swallowed so revert/report proceed.
  - Deploy-agent container still running pre-fix JS after merge: image is baked (`packages/deploy-agent/Dockerfile`); NAS must rebuild/recreate `deploy-agent` (assumption below).
  - Shared redaction package would pull `@homegrown/core` into the agent image: out of scope; two copies, no new dependency.

## Assumptions

- Staging and prod share one Postgres cluster, so dump roles exist at restore time.
- After this merges, a household NAS must rebuild the deploy-agent image and recreate that container; a pull of `main` into `/repo` is not enough. This upstream repo is the source of that image.
