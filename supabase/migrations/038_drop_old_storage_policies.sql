-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 038: oude (te ruime) storage-policies verwijderen
--
-- Deze policies stamden uit de eerdere opzet en worden vervangen door de
-- role-gecontroleerde "client-documents ... medisch" policies (migratie 037).
--
-- Belangrijkste reden: "arts read storage" (SELECT) liet authenticated
-- gebruikers documenten RECHTSTREEKS downloaden (eigen signed URL), waarmee de
-- backend-proxy én de auditlogging werden omzeild. Na verwijderen is er geen
-- authenticated SELECT meer → downloaden kan uitsluitend via de gelogde proxy.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "arts read storage"   on storage.objects;
drop policy if exists "arts upload storage" on storage.objects;
drop policy if exists "arts delete storage" on storage.objects;

-- Eindstand voor bucket 'client-documents' (uit migratie 037):
--   • INSERT  — client-documents insert medisch  (arts/leefstijlarts)
--   • UPDATE  — client-documents update medisch  (arts/leefstijlarts)
--   • DELETE  — client-documents delete medisch  (arts/leefstijlarts)
--   • SELECT  — GEEN (downloaden uitsluitend via backend-proxy / service-role)
