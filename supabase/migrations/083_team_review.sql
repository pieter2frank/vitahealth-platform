-- 083: Medisch-team-velden — "bespreken in medisch team" + vraag aan het team.
--
-- Twee plekken:
--   1. vh_annotation.team_vraag — open vraag van de beoordelaar aan het medisch
--      team, naast de bestaande bespreken_team-checkbox (annotatiemodule).
--   2. vh_client_team_review — dezelfde twee velden op dossierniveau
--      (cliëntdossier), één rij per cliënt.
-- Zichtbaarheid: uitsluitend medisch team (arts/leefstijlarts) — afgedwongen
-- met RLS op leesniveau; schrijven loopt via service_role-API's met rolcontrole.

alter table vh_annotation add column team_vraag text;

create table vh_client_team_review (
  client_id      uuid primary key references vh_client(id) on delete cascade,
  bespreken_team boolean not null default false,
  team_vraag     text,
  updated_by     uuid,                              -- auth.uid() van de laatste bewerker
  updated_at     timestamptz not null default now()
);

alter table vh_client_team_review enable row level security;

create policy "team read client team review" on vh_client_team_review for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));
