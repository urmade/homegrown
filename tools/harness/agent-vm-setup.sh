#!/usr/bin/env bash
# Agent VM: Node 22, pnpm, native Postgres 16, Playwright Chromium. Test-only credentials, never prod.
set -euo pipefail
if ! command -v psql >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-16 postgresql-client-16
fi
sudo service postgresql start
sudo -u postgres psql -qc "alter user postgres password 'postgres'"
sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'homegrown_test'" | grep -q 1 || sudo -u postgres createdb homegrown_test
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium || echo "playwright browser download failed; set PW_CHROME_PATH to a local Chrome"
pnpm gen
