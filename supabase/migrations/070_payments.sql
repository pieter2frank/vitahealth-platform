-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 070: betaalmuur — pakketten, orders, kortingscodes (fase 1)
--
-- Mollie kent geen productcatalogus: pakketten (naam/prijs/btw) leven hier.
-- Per bestelling wordt één vh_order aangemaakt; bij betaling koppelt Mollie via
-- de webhook op mollie_payment_id. Bedragen worden op de order BEVROREN, zodat
-- een latere prijswijziging de historie niet verandert.
--
-- Prijzen zijn INCLUSIEF btw (consumentenprijs); de btw-component rekenen we
-- eruit. btw_rate staat per pakket (nu 21%).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Pakketten (verkoopbare producten) ─────────────────────────────────────────
create table vh_package (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text,
  price_cents     int  not null,                 -- eindprijs INCL. btw
  vat_rate        numeric(5,2) not null default 21,
  includes_consult boolean not null default false,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ── Kortingscodes ─────────────────────────────────────────────────────────────
create table vh_discount_code (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,             -- opgeslagen in HOOFDLETTERS
  type         text not null check (type in ('percent', 'fixed')),
  value        int  not null,                    -- percent: 0-100 · fixed: centen
  package_id   uuid references vh_package(id) on delete cascade,  -- null = alle pakketten
  max_uses     int,                              -- null = onbeperkt
  used_count   int  not null default 0,
  valid_until  timestamptz,                      -- null = geen einddatum
  active       boolean not null default true,
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);

-- ── Orders ────────────────────────────────────────────────────────────────────
create table vh_order (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references vh_client(id) on delete set null,   -- na betaling
  package_id        uuid not null references vh_package(id),
  package_name      text not null,               -- snapshot voor factuur/overzicht
  email             text not null,
  amount_cents      int  not null,               -- daadwerkelijk te betalen (incl. btw, na korting)
  vat_cents         int  not null,               -- btw-component van amount_cents
  vat_rate          numeric(5,2) not null,
  discount_code     text,
  discount_cents    int  not null default 0,
  currency          text not null default 'EUR',
  status            text not null default 'open'
                    check (status in ('open', 'paid', 'failed', 'expired', 'canceled', 'refunded')),
  mollie_payment_id text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index vh_order_status_idx  on vh_order (status, created_at desc);
create index vh_order_client_idx  on vh_order (client_id);
create index vh_order_mollie_idx  on vh_order (mollie_payment_id);
create index vh_order_email_idx   on vh_order (email);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Publieke paywall leest het pakket server-side via service_role (geen anon-
-- policy nodig). Ingelogde medewerkers zien pakketten/orders/codes in het
-- beheer; schrijven gebeurt uitsluitend server-side via service_role.
alter table vh_package       enable row level security;
alter table vh_order         enable row level security;
alter table vh_discount_code enable row level security;

create policy "auth read package"  on vh_package       for select to authenticated using (true);
create policy "auth read order"    on vh_order         for select to authenticated using (true);
create policy "auth read discount" on vh_discount_code for select to authenticated using (true);

-- ── Seed: de twee startpakketten ──────────────────────────────────────────────
insert into vh_package (slug, name, description, price_cents, vat_rate, includes_consult, sort_order) values
  ('biomarkertest',
   'Vitahealth Biomarkertest',
   'Uitgebreide biomarker-bloedtest met persoonlijke rapportage.',
   24000, 21, false, 1),
  ('biomarkertest-consult',
   'Vitahealth Biomarkertest met terugkoppeling leefstijlarts',
   'Biomarkertest inclusief een persoonlijk consult met een leefstijlarts om de uitslag te bespreken.',
   39000, 21, true, 2);

notify pgrst, 'reload schema';
