create table core.members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);
insert into core.members (display_name) values ('Haushalt');

-- Append-only for the app role: deploys, rollbacks, migrations, kill-switch changes.
create table core.events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  kind text not null,
  sha text,
  detail jsonb
);
create index on core.events (ts desc);

create table core.flags (
  name text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into core.flags (name) values ('pause_deploys');

create schema logs;
create table logs.logs (
  id bigserial primary key,
  ts timestamptz not null,
  level text not null,
  module text,
  fn text,
  member_id uuid,
  correlation_id text,
  sha text,
  msg text not null,
  data jsonb
);
create index on logs.logs (ts desc);
create index on logs.logs (module, level);
create index on logs.logs (correlation_id);
