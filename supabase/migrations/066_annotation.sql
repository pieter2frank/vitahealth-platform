-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 066: annotatiemodule (arts/leefstijlarts labelen dossiers)
--
-- Een admin stelt een RONDE samen met een aantal dossiers (casussen) waarvan
-- zowel de vragenlijst als de biomarkeruitslag beschikbaar is. Iedere arts uit
-- het medisch team annoteert elke casus: een gestructureerd oordeel + optionele
-- tekst-highlights. De inhoud is patiënt-gekoppelde bijzondere gezondheidsdata →
-- RLS beperkt tot het medisch team, net als vh_advice (migratie 058).
--
-- Schrijven van rondes/casussen gebeurt server-side via service_role (admin-API);
-- annotaties schrijft de arts zelf (eigen rijen) via de authenticated client.
-- ─────────────────────────────────────────────────────────────────────────────

-- Predikaat: is de huidige gebruiker medisch team?
--   exists (select 1 from vh_medewerker where user_id = auth.uid()
--           and role in ('arts','leefstijlarts'))

-- ── Ronde ─────────────────────────────────────────────────────────────────────
create table vh_annotation_round (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  note        text,
  status      text not null default 'open' check (status in ('open', 'gesloten')),
  created_by  text,                    -- naam/aanmaker (admin)
  created_at  timestamptz not null default now()
);

-- ── Casussen in een ronde ─────────────────────────────────────────────────────
create table vh_annotation_case (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references vh_annotation_round(id) on delete cascade,
  client_id   uuid not null references vh_client(id)          on delete cascade,
  created_at  timestamptz not null default now(),
  unique (round_id, client_id)
);
create index vh_annotation_case_round_idx on vh_annotation_case (round_id);

-- ── Annotatie: één per arts per casus ─────────────────────────────────────────
create table vh_annotation (
  id                 uuid primary key default gen_random_uuid(),
  round_id           uuid not null references vh_annotation_round(id) on delete cascade,
  client_id          uuid not null references vh_client(id)          on delete cascade,
  arts_user_id       uuid not null,               -- auth.uid() van de annoterende arts
  algemeen_beeld     text,                         -- korte anamnese (vrije tekst)
  bespreken_team     boolean,                      -- bespreken in medisch team ja/nee
  advies             text,                         -- advies (top 3, vrije tekst)
  verbeterpotentieel int,                          -- schaal 0-10
  vervolg_domeinen   text[] not null default '{}', -- tags (medicatie, beweging, …)
  wearables_nuttig   boolean,                      -- wearables nuttig bij vervolg ja/nee
  status             text not null default 'concept' check (status in ('concept', 'ingediend')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  unique (round_id, client_id, arts_user_id)
);
create index vh_annotation_arts_idx  on vh_annotation (arts_user_id, status);
create index vh_annotation_round_idx on vh_annotation (round_id, client_id);

-- ── Tekst-highlights bij een annotatie (fase 2 vult dit; tabel nu al klaar) ────
create table vh_annotation_highlight (
  id             uuid primary key default gen_random_uuid(),
  annotation_id  uuid not null references vh_annotation(id) on delete cascade,
  source_field   text,               -- welk blok: 'vragenlijst' | 'biomarkers' | 'kenmerken'
  selected_text  text not null,
  context_before text,
  context_after  text,
  note           text,
  created_at     timestamptz not null default now()
);
create index vh_annotation_highlight_aid_idx on vh_annotation_highlight (annotation_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table vh_annotation_round     enable row level security;
alter table vh_annotation_case      enable row level security;
alter table vh_annotation           enable row level security;
alter table vh_annotation_highlight enable row level security;

-- Rondes + casussen: leesbaar voor medisch team (schrijven via service_role).
create policy "team read round" on vh_annotation_round for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

create policy "team read case" on vh_annotation_case for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

-- Annotaties: een arts ziet en beheert UITSLUITEND zijn eigen annotaties.
create policy "arts read own annotation" on vh_annotation for select to authenticated
  using (arts_user_id = auth.uid()
         and exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

create policy "arts insert own annotation" on vh_annotation for insert to authenticated
  with check (arts_user_id = auth.uid()
              and exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

create policy "arts update own annotation" on vh_annotation for update to authenticated
  using (arts_user_id = auth.uid())
  with check (arts_user_id = auth.uid());

-- Highlights: gekoppeld aan een eigen annotatie.
create policy "arts read own highlight" on vh_annotation_highlight for select to authenticated
  using (exists (select 1 from vh_annotation a where a.id = annotation_id and a.arts_user_id = auth.uid()));

create policy "arts write own highlight" on vh_annotation_highlight for all to authenticated
  using (exists (select 1 from vh_annotation a where a.id = annotation_id and a.arts_user_id = auth.uid()))
  with check (exists (select 1 from vh_annotation a where a.id = annotation_id and a.arts_user_id = auth.uid()));

notify pgrst, 'reload schema';
