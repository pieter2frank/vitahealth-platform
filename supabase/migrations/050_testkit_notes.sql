-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 050: vrij opmerkingenveld op de testkit
--
-- Zodat medewerkers altijd iets kunnen vastleggen over een specifieke kit
-- (bijv. "afname mislukt — vervangkit opgestuurd").
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_testkit
  add column if not exists notes text;
