-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 067: artsen toewijzen aan een annotatieronde
--
-- Voorheen zag elke arts elke ronde. Nu kan de admin bij het aanmaken van een
-- ronde selecteren welke artsen annoteren. Een ronde ZONDER rijen hier is
-- zichtbaar voor alle artsen (achterwaarts compatibel met bestaande rondes).
-- ─────────────────────────────────────────────────────────────────────────────

create table vh_annotation_round_arts (
  round_id     uuid not null references vh_annotation_round(id) on delete cascade,
  arts_user_id uuid not null,
  created_at   timestamptz not null default now(),
  primary key (round_id, arts_user_id)
);
create index vh_annotation_round_arts_user_idx on vh_annotation_round_arts (arts_user_id);

alter table vh_annotation_round_arts enable row level security;

-- Leesbaar voor medisch team (schrijven via service_role / admin-API).
create policy "team read round arts" on vh_annotation_round_arts for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

notify pgrst, 'reload schema';
