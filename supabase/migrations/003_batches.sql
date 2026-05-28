-- Vita Health — module 5: Batches NH
-- Voer uit via Supabase SQL Editor

-- Batches tabel
create table vh_batch (
  id          uuid primary key default gen_random_uuid(),
  badge_id    text not null,
  sent_date   date not null,
  notes       text,
  status      text not null default 'sent',   -- sent | results_received
  results_date date,
  created_at  timestamptz not null default now()
);

-- FK van testkit naar batch
alter table vh_testkit add column batch_id uuid references vh_batch(id) on delete set null;
create index vh_testkit_batch_idx on vh_testkit (batch_id);

-- RLS voor vh_batch
alter table vh_batch enable row level security;

create policy "Authenticated users can read batches"
  on vh_batch for select to authenticated using (true);
create policy "Authenticated users can insert batches"
  on vh_batch for insert to authenticated with check (true);
create policy "Authenticated users can update batches"
  on vh_batch for update to authenticated using (true);
create policy "Authenticated users can delete batches"
  on vh_batch for delete to authenticated using (true);

-- DELETE policies voor bestaande tabellen (nodig voor verwijderknop)
create policy "Authenticated users can delete testkits"
  on vh_testkit for delete to authenticated using (true);
create policy "Authenticated users can delete clients"
  on vh_client for delete to authenticated using (true);
create policy "Authenticated users can delete arbo"
  on vh_arbo for delete to authenticated using (true);
create policy "Authenticated users can delete companies"
  on vh_company for delete to authenticated using (true);
