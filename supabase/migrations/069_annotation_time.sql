-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 069: beoordelingstijd per annotatie
--
-- Houdt bij hoeveel tijd een arts aan een dossier besteedt (open → sluiten),
-- opgeteld over meerdere sessies (concept opslaan en later heropenen). De client
-- stuurt tijdsblokken die hier worden opgeteld.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_annotation
  add column if not exists time_spent_seconds int not null default 0;

notify pgrst, 'reload schema';
