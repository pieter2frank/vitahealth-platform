-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 054: qualifier bij bloedmarkerwaarden
--
-- Sommige waarden staan in het rapport met een vergelijkingsteken ervoor
-- (bijv. "> 35.8 %" of "< 0.1"): de waarde valt buiten het meetbereik.
-- value_qualifier bewaart dat teken; value bevat het getal.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_report_biomarker add column if not exists value_qualifier text;
