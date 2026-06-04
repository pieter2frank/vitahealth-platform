-- Migratie 020: consent_version kolom voor juridische traceerbaarheid
-- Slaat op welke versie van de toestemmingsteksten de cliënt heeft gezien.
-- v1 = originele 14 losse vinkjes
-- v2 = geconsolideerd naar 4 vinkjes (jun 2026)

alter table vh_consent
  add column if not exists consent_version smallint not null default 2;

-- Bestaande records (ingevuld met de oude 14 vinkjes) markeren als v1
update vh_consent
  set consent_version = 1
  where array_length(required, 1) = 14;

comment on column vh_consent.consent_version is
  'Versie van de toestemmingsteksten: 1=14 losse vinkjes (origineel), 2=4 geconsolideerde vinkjes (jun 2026)';
