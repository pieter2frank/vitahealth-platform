-- Migratie 035: vastleggen van de geschiktheidsverklaring (stap 4)
-- Legt vast wat de deelnemer heeft verklaard over de uitsluitingscriteria,
-- inclusief de exact getoonde criteria-tekst en het tijdstip.

create table if not exists vh_screener_response (
  id               uuid        primary key default gen_random_uuid(),
  client_id        uuid        not null references vh_client(id) on delete cascade,
  declaration      text        not null check (declaration in ('niet_van_toepassing', 'mogelijk_van_toepassing')),
  criteria_version int         not null,
  criteria_text    jsonb       not null,   -- exact getoonde lijst (string[])
  created_at       timestamptz not null default now()
);

create index on vh_screener_response (client_id, created_at desc);

alter table vh_screener_response enable row level security;

-- Medewerkers mogen verklaringen lezen
create policy "auth read screener response"
  on vh_screener_response for select to authenticated using (true);

-- Schrijven loopt via de API (service role) — niet rechtstreeks vanuit portaal
revoke insert, update, delete on vh_screener_response from authenticated, anon;
