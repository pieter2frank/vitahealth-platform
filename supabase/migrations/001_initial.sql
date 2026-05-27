-- Vita Health Platform — initieel schema
-- Gebruik in Supabase: SQL Editor → plak en voer uit

-- Enum voor testkit status
create type testkit_status as enum (
  'received',
  'assigned',
  'retour',
  'sent_nightingale',
  'results_available'
);

-- Cliënten
create table vh_client (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null,
  email         text,
  phone         text,
  birth_date    date,
  address       text,
  city          text,
  postal_code   text,
  created_at    timestamptz not null default now()
);

-- Arbodiensten
create table vh_arbo (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  city          text,
  postal_code   text,
  created_at    timestamptz not null default now()
);

-- Bedrijven (niet via arbo)
create table vh_company (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  city          text,
  postal_code   text,
  kvk           text,
  created_at    timestamptz not null default now()
);

-- Testkits
create table vh_testkit (
  id                  uuid primary key default gen_random_uuid(),
  barcode             text not null unique,
  date                timestamptz not null default now(),
  assigned            boolean not null default false,
  assigned_client_id  uuid references vh_client(id) on delete set null,
  assigned_company_id uuid references vh_company(id) on delete set null,
  assigned_arbo_id    uuid references vh_arbo(id) on delete set null,
  assigned_date       timestamptz,
  retour_date         timestamptz,
  badge_id            text,
  badge_datesent      timestamptz,
  results_date        timestamptz,
  status              testkit_status not null default 'received',
  created_at          timestamptz not null default now()
);

-- Indexen voor veelgebruikte queries
create index vh_testkit_barcode_idx   on vh_testkit (barcode);
create index vh_testkit_status_idx    on vh_testkit (status);
create index vh_testkit_date_idx      on vh_testkit (date desc);

-- RLS: alleen ingelogde medewerkers
alter table vh_testkit enable row level security;
alter table vh_client   enable row level security;
alter table vh_arbo     enable row level security;
alter table vh_company  enable row level security;

create policy "Authenticated users can read testkits"
  on vh_testkit for select to authenticated using (true);
create policy "Authenticated users can insert testkits"
  on vh_testkit for insert to authenticated with check (true);
create policy "Authenticated users can update testkits"
  on vh_testkit for update to authenticated using (true);

create policy "Authenticated users can read clients"
  on vh_client for select to authenticated using (true);
create policy "Authenticated users can insert clients"
  on vh_client for insert to authenticated with check (true);
create policy "Authenticated users can update clients"
  on vh_client for update to authenticated using (true);

create policy "Authenticated users can read arbo"
  on vh_arbo for select to authenticated using (true);
create policy "Authenticated users can insert arbo"
  on vh_arbo for insert to authenticated with check (true);

create policy "Authenticated users can read companies"
  on vh_company for select to authenticated using (true);
create policy "Authenticated users can insert companies"
  on vh_company for insert to authenticated with check (true);
