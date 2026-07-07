-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 062 (P2-beveiliging): kennisbank alleen leesbaar voor beheerders
--
-- Achtergrond: vh_knowledge/vh_knowledge_chunk waren leesbaar voor ALLE
-- ingelogde medewerkers. De casusdocumenten ("Casus (arts)") bevatten echter
-- gepseudonimiseerde gezondheidsdata. Dit sluit dat gelijk met vh_advice
-- (arts-only).
--
-- Impact: de RAG-adviesflow leest server-side via service_role (RLS niet van
-- toepassing) en blijft werken. De kennisbank-UI is al beperkt tot admin/arts/
-- leefstijlarts, dus geen codewijziging nodig. Geen uitvoervolgorde-afhankelijkheid.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "auth read knowledge"       on vh_knowledge;
drop policy if exists "auth read knowledge chunk" on vh_knowledge_chunk;

create policy "staff read knowledge" on vh_knowledge for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('admin', 'arts', 'leefstijlarts')));

create policy "staff read knowledge chunk" on vh_knowledge_chunk for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('admin', 'arts', 'leefstijlarts')));

notify pgrst, 'reload schema';
