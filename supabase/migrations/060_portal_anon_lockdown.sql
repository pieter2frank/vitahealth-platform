-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 060 (P0-beveiliging, deel 2 van 2): brede anon-leespolicies intrekken
--
-- Draai deze migratie PAS NADAT de code die migratie 059 gebruikt (RPC's
-- portal_register_client / portal_get_assignment) is gedeployed. Anders lezen
-- oude portalpagina's nog rechtstreeks van de tabellen en breken ze.
--
-- Effect: met de publieke anon-key kan niemand meer de klanten- of tokentabel
-- uitlezen of enumereren. De portal gebruikt hiervoor nu uitsluitend
-- token-gescopete SECURITY DEFINER-RPC's.
-- ─────────────────────────────────────────────────────────────────────────────

-- Anon kon de VOLLEDIGE vh_client-tabel lezen (naam, e-mail, adres, geboortedatum).
drop policy if exists "anon read client by id" on vh_client;

-- Anon kon ALLE intake-tokens lezen, waardoor het onraadbare-token-model faalde.
drop policy if exists "anon select token" on vh_intake_token;

notify pgrst, 'reload schema';
