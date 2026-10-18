# 0001 Merge and deploy pipeline

- PRs merge through `auto-merge.yml`, which runs only `main`'s copy (workflow_run on ci, a 10-minute sweep, manual dispatch).
- A PR merges when it is non-draft, touches no CODEOWNERS path, its latest `ci` run is green and its branch contains `main`.
  The bot updates stale branches and re-runs CI itself, and retries failed jobs once per SHA.
- Bot merges and branch updates use GITHUB_TOKEN, which starts no workflows, so the bot dispatches `ci` explicitly.
- The deploy agent deploys only `main` SHAs whose latest `ci` run is green, and reverts (keeping migrations) on staging or prod failure.
