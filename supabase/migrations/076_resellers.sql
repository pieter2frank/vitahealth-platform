-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 076: resellers
--
-- Een reseller kan zijn eigen klanten een kortingscode geven. De code is gewoon
-- een vh_discount_code met een reseller eraan gekoppeld (hergebruik van de hele
-- kortingscode-engine). Voor stabiele omzet-toerekening leggen we de reseller ook
-- op de order vast op het moment van afrekenen — zo blijft het overzicht kloppen
-- ook als de code later wordt gewijzigd of verwijderd.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists vh_reseller (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  postal_code    text,
  city           text,
  kvk            text,
  active         boolean not null default true,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);

alter table vh_reseller enable row level security;
drop policy if exists "auth read reseller" on vh_reseller;
create policy "auth read reseller" on vh_reseller for select to authenticated using (true);

-- Code → reseller: bij verwijderen van de reseller de code ontkoppelen (niet weggooien).
alter table vh_discount_code
  add column if not exists reseller_id uuid references vh_reseller(id) on delete set null;

-- Order → reseller: geen cascade/set-null, zodat een reseller met bestellingen niet
-- per ongeluk te verwijderen is (attributie blijft behouden; de API verwijst dan
-- naar deactiveren).
alter table vh_order
  add column if not exists reseller_id uuid references vh_reseller(id);

create index if not exists vh_discount_code_reseller_idx on vh_discount_code (reseller_id);
create index if not exists vh_order_reseller_idx          on vh_order (reseller_id);

comment on table vh_reseller is 'Resellers die via een gekoppelde kortingscode klanten werven.';
