#!/bin/sh
# Build-time only: start a throwaway Postgres, apply migrations, generate .homegrown/data-flow.json.
set -eu
PGDATA=$(mktemp -d)
chown postgres "$PGDATA"
su postgres -c "initdb -D $PGDATA -U postgres --auth=trust >/dev/null"
su postgres -c "pg_ctl -D $PGDATA -o '-k /tmp -c listen_addresses=' -w start >/dev/null"
trap 'su postgres -c "pg_ctl -D $PGDATA -m fast stop >/dev/null"' EXIT
export MIGRATE_DATABASE_URL="postgres://postgres@localhost/postgres?host=/tmp"
pnpm -s migrate
pnpm -s gen:data-flow
