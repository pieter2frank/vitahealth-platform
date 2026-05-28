-- Aanvragen van individuele klanten via ikwilgraageentest.vita-health.nl

create table vh_order (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  birth_date    date,
  address       text not null,
  city          text not null,
  postal_code   text not null,
  status        text not null default 'nieuw',
  -- 'nieuw' | 'bevestigd' | 'kit_verzonden' | 'afgerond' | 'geannuleerd'
  client_id     uuid references vh_client(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index vh_order_status_idx on vh_order (status);
create index vh_order_created_idx on vh_order (created_at desc);

-- RLS
alter table vh_order enable row level security;

-- Iedereen (ook niet-ingelogd) mag een aanvraag indienen
create policy "Iedereen kan aanvraag indienen"
  on vh_order for insert
  with check (true);

-- Alleen medewerkers mogen aanvragen lezen en bijwerken
create policy "Authenticated users kunnen aanvragen lezen"
  on vh_order for select to authenticated using (true);

create policy "Authenticated users kunnen aanvragen bijwerken"
  on vh_order for update to authenticated using (true);
