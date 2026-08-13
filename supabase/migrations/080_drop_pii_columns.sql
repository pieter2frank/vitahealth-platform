-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 080: PII-kolommen droppen (PII-kluis, fase 3 — stap 2 van 2)
--
-- ⚠️  DESTRUCTIEF — POINT OF NO RETURN. Pas draaien als:
--   1. migratie 079 is gedraaid,
--   2. de nieuwe build (zonder oude-kolom-writes) is gedeployed én rookgetest,
--   3. er een VERSE DATABASE-BACKUP is.
--
-- Hierna bestaan naam, adres, e-mail, telefoon en geboortedatum uitsluitend nog
-- versleuteld in vh_client_identity. Een databasedump is vanaf dit moment
-- naamloos. Zie docs/pii-kluis-implementatieplan-v1.0.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_client
  drop column if exists first_name,
  drop column if exists last_name,
  drop column if exists email,
  drop column if exists phone,
  drop column if exists birth_date,
  drop column if exists address,
  drop column if exists postal_code,
  drop column if exists city;

comment on table vh_client is
  'Pseudoniem cliëntdossier. Herleidbare persoonsgegevens staan uitsluitend versleuteld in vh_client_identity (PII-kluis).';

notify pgrst, 'reload schema';
