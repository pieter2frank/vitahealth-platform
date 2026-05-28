-- Vita Health — aantekeningen arts per cliënt (meerdere notities per cliënt)
-- Uitvoeren via Supabase SQL Editor

create table vh_client_note (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references vh_client(id) on delete cascade,
  notes      text not null default '',
  actions    text not null default '',
  created_by text not null default '',
  updated_by text,                          -- null = nooit bewerkt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vh_client_note_client_idx on vh_client_note (client_id, created_at desc);

alter table vh_client_note enable row level security;

-- Alleen arts en leefstijlarts kunnen aantekeningen zien en beheren
create policy "arts read client notes"
  on vh_client_note for select to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts insert client notes"
  on vh_client_note for insert to authenticated
  with check (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts update client notes"
  on vh_client_note for update to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts delete client notes"
  on vh_client_note for delete to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );
