create table entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit text,
  done boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'pantry')),
  -- core member id; no cross-module foreign keys
  added_by uuid,
  created_at timestamptz not null default now()
);
create index entries_open_idx on entries (done, created_at);
