-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 061 (P1-beveiliging): anon-schrijftoegang op vh_client inperken
--
-- Achtergrond: de policy "anon update client enrollment" beperkte alleen de
-- status van de rij, niet de kolommen. Anon kon daardoor naam/e-mail/adres van
-- elke cliënt in een vroege status overschrijven (identity-hijack, bijv. e-mail
-- kapen). De portal schrijft echter alleen contact-/adresvelden en de status.
--
-- Oplossing: kolom-privileges. Anon mag na deze migratie UITSLUITEND deze velden
-- bijwerken; naam en e-mail zijn niet meer door anon schrijfbaar. Die worden nog
-- enkel bij registratie gezet via portal_register_client (SECURITY DEFINER, migr. 059).
--
-- Draai deze migratie NA de P0-uitrol (059 → deploy → 060), zodat de portal de
-- register-RPC al gebruikt.
-- ─────────────────────────────────────────────────────────────────────────────

-- Blanket UPDATE-recht van anon intrekken en alleen de legitieme kolommen teruggeven.
revoke update on vh_client from anon;
grant  update (enrollment_status, phone, birth_date, address, postal_code, city)
  on vh_client to anon;

-- Anon hoeft geen cliënten meer te INSERTEN: dat loopt via portal_register_client.
drop policy if exists "anon insert client" on vh_client;

notify pgrst, 'reload schema';
