create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'Stück',
  quantity integer not null default 0 check (quantity >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  -- core member id; no cross-module foreign keys
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create unique index items_name_key on items (lower(name));
