-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 063 (P3-hardening): leestoegang minimaliseren
--
-- P3-9: vh_consent en vh_screener_response waren leesbaar voor ALLE ingelogde
--       medewerkers. Consent wordt alleen door de admin-toestemmingenpagina en
--       de service_role-bevestiging gelezen; de screenerverklaring (medische
--       geschiktheid) hoort bij arts/leefstijlarts/admin. De logistieke
--       'medewerker'-rol heeft ze niet nodig.
-- P3-13: vh_setting was volledig anon-leesbaar; de portal heeft alleen de sleutel
--        'intake_questionnaire_id' nodig. We scopen de anon-leestoegang daartoe.
--
-- Geen anon-flow-afhankelijkheid; veilig los te draaien.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── P3-9: consent alleen voor beheer/klinische rollen ─────────────────────────
drop policy if exists "auth read consent" on vh_consent;
create policy "staff read consent" on vh_consent for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('admin', 'arts', 'leefstijlarts')));

-- ── P3-9: screenerverklaring alleen voor beheer/klinische rollen ──────────────
drop policy if exists "auth read screener response" on vh_screener_response;
create policy "staff read screener response" on vh_screener_response for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('admin', 'arts', 'leefstijlarts')));

-- ── P3-13: anon mag alleen de intake-vragenlijst-sleutel lezen ────────────────
drop policy if exists "anon read setting" on vh_setting;
create policy "anon read setting key" on vh_setting for select to anon
  using (key = 'intake_questionnaire_id');

notify pgrst, 'reload schema';
