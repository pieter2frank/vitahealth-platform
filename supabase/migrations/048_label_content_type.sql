-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 048: bestandstype van het opgeslagen PostNL-label
--
-- PostNL kan een label als PDF óf als afbeelding (GIF/JPG 200 dpi) teruggeven,
-- afhankelijk van het Printertype. We bewaren het MIME-type zodat het label
-- later met het juiste bestandstype opnieuw geprint kan worden.
-- Bestaande (PDF-)labels: NULL → terugval op application/pdf.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_testkit
  add column if not exists label_content_type        text,
  add column if not exists return_label_content_type text;
