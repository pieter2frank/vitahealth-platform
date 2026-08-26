-- 084: Casusbesprekingen medisch expertteam (MDO-dashboard in de annotatiemodule).
--
-- Een arts of admin maakt een bespreking aan (titel + datum) en kiest de
-- dossiers. Het dashboard toont per casus de volledige casusinformatie,
-- de arts-input uit de annotatiemodule en de vraag aan het team; het team
-- legt besprekingsnotities vast en markeert casussen als besproken.

create table vh_team_meeting (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  meeting_date date not null,
  status       text not null default 'open' check (status in ('open', 'afgerond')),
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create table vh_team_meeting_case (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references vh_team_meeting(id) on delete cascade,
  client_id    uuid not null references vh_client(id) on delete cascade,
  position     int  not null default 0,
  discussed    boolean not null default false,
  discussed_at timestamptz,
  notes        text,                -- besproken in het medisch expertteam
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  unique (meeting_id, client_id)
);
create index vh_team_meeting_case_mid_idx on vh_team_meeting_case (meeting_id, position);

alter table vh_team_meeting      enable row level security;
alter table vh_team_meeting_case enable row level security;

-- Lezen: medisch team + admin (admin maakt besprekingen aan en ziet de lijst;
-- de dashboard-inhoud zelf is via de pagina-guard beperkt tot arts/leefstijlarts).
-- Schrijven uitsluitend via service_role-API's met rolcontrole.
create policy "team read meeting" on vh_team_meeting for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts', 'admin')));
create policy "team read meeting case" on vh_team_meeting_case for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts', 'admin')));
