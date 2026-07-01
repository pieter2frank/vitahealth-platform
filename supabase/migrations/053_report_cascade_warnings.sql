-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 053: rapport opruimen bij verwijderen PDF + waarschuwingen bewaren
--
-- 1. Verwijderen van een cliëntdocument (PDF) moet ook het uitgelezen rapport
--    (en zijn ziekterisico's/bloedmarkers) verwijderen → FK op CASCADE.
-- 2. Kolom warnings[] om parser-/controlewaarschuwingen te tonen in het
--    reviewscherm (bijv. kit-ID komt niet overeen met de bestandsnaam).
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_report drop constraint if exists vh_report_document_id_fkey;
alter table vh_report
  add constraint vh_report_document_id_fkey
  foreign key (document_id) references vh_client_document(id) on delete cascade;

alter table vh_report add column if not exists warnings text[];
