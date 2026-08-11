-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 073: factuur-/klantgegevens op de order
--
-- De paywall vraagt naast e-mail nu ook naam + adres, zodat de factuur compleet
-- is en de cliënt (bij betaling) met deze gegevens wordt aangemaakt. De order
-- bewaart ze tot betaling; er ontstaat geen cliëntrecord vóór de betaling.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_order
  add column if not exists buyer_first_name  text,
  add column if not exists buyer_last_name   text,
  add column if not exists buyer_address     text,
  add column if not exists buyer_postal_code text,
  add column if not exists buyer_city        text;

notify pgrst, 'reload schema';
