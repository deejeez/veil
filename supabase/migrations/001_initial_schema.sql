-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- COUPLES
create table couples (
  id                uuid primary key default uuid_generate_v4(),
  created_at        timestamptz not null default now(),
  user_id_primary   uuid references auth.users not null,
  user_id_partner   uuid references auth.users,
  email_primary     text not null,
  email_partner     text,
  wedding_date      date,
  venue_name        text,
  city              text,
  state             text,
  budget_total      numeric,
  paid              boolean not null default false,
  stripe_session_id text,
  vibe_profile      jsonb
);

alter table couples enable row level security;

create policy "couple members can read their couple"
  on couples for select
  using (auth.uid() = user_id_primary or auth.uid() = user_id_partner);

create policy "couple members can update their couple"
  on couples for update
  using (auth.uid() = user_id_primary or auth.uid() = user_id_partner);

create policy "authenticated users can insert their own couple"
  on couples for insert
  with check (auth.uid() = user_id_primary);

-- VENDORS
create table vendors (
  id            uuid primary key default uuid_generate_v4(),
  couple_id     uuid references couples not null,
  category      text not null,
  name          text,
  status        text not null default 'not_started',
  contact_name  text,
  contact_email text,
  contact_phone text,
  website       text,
  notes         text,
  booked_amount numeric,
  created_at    timestamptz not null default now()
);

alter table vendors enable row level security;

create policy "couple members can manage vendors"
  on vendors for all
  using (
    couple_id in (
      select id from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

-- PAYMENTS
create table payments (
  id        uuid primary key default uuid_generate_v4(),
  couple_id uuid references couples not null,
  vendor_id uuid references vendors,
  label     text not null,
  amount    numeric not null,
  due_date  date,
  paid_date date,
  paid_by   text not null default 'couple',
  notes     text
);

alter table payments enable row level security;

create policy "couple members can manage payments"
  on payments for all
  using (
    couple_id in (
      select id from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

-- BUDGET CATEGORIES
create table budget_categories (
  id        uuid primary key default uuid_generate_v4(),
  couple_id uuid references couples not null,
  category  text not null,
  budgeted  numeric not null default 0
);

alter table budget_categories enable row level security;

create policy "couple members can manage budget categories"
  on budget_categories for all
  using (
    couple_id in (
      select id from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

-- CONTRACTS
create table contracts (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid references couples not null,
  vendor_id   uuid references vendors not null,
  file_path   text not null,
  file_name   text not null,
  uploaded_at timestamptz not null default now(),
  ai_review   jsonb
);

alter table contracts enable row level security;

create policy "couple members can manage contracts"
  on contracts for all
  using (
    couple_id in (
      select id from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

-- AI INSIGHTS
create table ai_insights (
  id         uuid primary key default uuid_generate_v4(),
  couple_id  uuid references couples not null,
  type       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table ai_insights enable row level security;

create policy "couple members can manage ai insights"
  on ai_insights for all
  using (
    couple_id in (
      select id from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

-- Indexes on foreign key columns (PostgreSQL does not auto-index FKs)
create index on vendors (couple_id);
create index on payments (couple_id);
create index on payments (vendor_id);
create index on budget_categories (couple_id);
create index on contracts (couple_id);
create index on contracts (vendor_id);
create index on ai_insights (couple_id);

-- STORAGE: contracts bucket
insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false);

create policy "couple members can upload contracts"
  on storage.objects for insert
  with check (
    bucket_id = 'contracts' and
    (storage.foldername(name))[1] in (
      select id::text from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

create policy "couple members can read contracts"
  on storage.objects for select
  using (
    bucket_id = 'contracts' and
    (storage.foldername(name))[1] in (
      select id::text from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );

create policy "couple members can delete contracts"
  on storage.objects for delete
  using (
    bucket_id = 'contracts' and
    (storage.foldername(name))[1] in (
      select id::text from couples
      where auth.uid() = user_id_primary or auth.uid() = user_id_partner
    )
  );
