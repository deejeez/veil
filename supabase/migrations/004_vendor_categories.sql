-- Per-couple vendor category registry.
-- Seeded from the 14 app defaults on first load; couples can add/rename/remove.

create table vendor_categories (
  id         uuid primary key default uuid_generate_v4(),
  couple_id  uuid references couples(id) on delete cascade not null,
  slug       text not null,
  label      text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (couple_id, slug)
);

alter table vendor_categories enable row level security;

create policy "Couple members can manage their categories"
  on vendor_categories
  for all
  using (
    couple_id in (
      select couple_id from couple_members where user_id = auth.uid()
    )
  )
  with check (
    couple_id in (
      select couple_id from couple_members where user_id = auth.uid()
    )
  );
