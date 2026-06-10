-- Migratie 043: het aangemaakte PostNL-label (base64 PDF) bewaren bij de kit,
-- zodat het later opnieuw geprint kan worden zonder een nieuw label aan te maken.

alter table vh_testkit
  add column if not exists label_pdf text;
