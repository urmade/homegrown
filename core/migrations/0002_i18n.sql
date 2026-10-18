-- Household-wide settings (household_locale is chosen on first setup).
create table core.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Per-member override; null means "use the household language".
alter table core.members add column locale text;
