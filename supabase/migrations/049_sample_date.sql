-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 049: afnamedatum op de testkit
--
-- Bij het registreren van een retour wordt de datum van afname (wanneer de
-- cliënt het monster heeft afgenomen) ingevoerd. Deze datum is verplicht om de
-- kit in een batch naar Nightingale te kunnen opnemen.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_testkit
  add column if not exists sample_date date;

comment on column vh_testkit.sample_date is
  'Datum van monsterafname door de cliënt; verplicht voordat de kit in een batch kan.';
