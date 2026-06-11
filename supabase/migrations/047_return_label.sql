-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 047: retourlabel per testkit
--
-- Naast het uitgaande verzendlabel kan nu ook een retourlabel worden aangemaakt
-- (geadresseerd aan het in de instellingen opgegeven retouradres). De barcode
-- bevat de kit-codering, zodat bij terugkomst zichtbaar is om welke kit het gaat.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_testkit
  add column if not exists return_tracking_code    text,
  add column if not exists return_tracking_url     text,
  add column if not exists return_label_pdf        text,
  add column if not exists return_label_created_at timestamptz;

-- Het retouradres zelf wordt opgeslagen in vh_setting onder de sleutel
-- 'retour_adres' (JSON). Geen schemawijziging nodig: vh_setting is key/value.
