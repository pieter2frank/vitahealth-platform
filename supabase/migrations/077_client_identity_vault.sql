-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 077: identiteitskluis (PII-kluis, fase 0)
--
-- Aparte tabel voor herleidbare persoonsgegevens, per veld versleuteld door de
-- APPLICATIE (AES-256-GCM; sleutel staat buiten de database, in de server-env).
-- De database ziet alleen ciphertext. email_hash (HMAC) maakt lookups op
-- e-mailadres mogelijk zonder het adres leesbaar op te slaan.
--
-- Toegang: RLS aan zonder policies + revoke voor anon/authenticated → alleen
-- service_role kan bij de tabel, en alleen de app kan ontsleutelen (dubbel slot).
-- Zie docs/pii-kluis-implementatieplan-v1.0.docx.
--
-- Fase 0: tabel bestaat maar wordt nog niet gebruikt (additief, geen gedrag).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists vh_client_identity (
  client_id       uuid primary key references vh_client(id) on delete cascade,
  first_name_enc  text,
  last_name_enc   text,
  email_enc       text,
  phone_enc       text,
  birth_date_enc  text,
  address_enc     text,
  postal_code_enc text,
  city_enc        text,
  email_hash      text,          -- HMAC-SHA256 over lowercase/trimmed e-mail
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists vh_client_identity_email_hash_idx on vh_client_identity (email_hash);

-- Dubbel slot: RLS aan zonder policies (deny-by-default) én expliciete revoke.
alter table vh_client_identity enable row level security;
revoke all on vh_client_identity from anon, authenticated;

comment on table vh_client_identity is
  'Identiteitskluis: herleidbare persoonsgegevens, per veld versleuteld door de applicatie (sleutel buiten de DB). Alleen service_role.';
