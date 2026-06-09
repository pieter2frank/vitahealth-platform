-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 037: RLS op storage.objects voor de bucket 'client-documents'
-- (medische uitslag-PDF's).
--
-- Strategie:
--   • Lezen/downloaden gaat UITSLUITEND via de backend-proxy
--     (/api/documenten/[docId]/download) met de service-role key, die RLS
--     bypasst. Er is dus GEEN authenticated SELECT-policy → de browser kan
--     objecten niet rechtstreeks opvragen of listen.
--   • Uploaden en verwijderen mag alleen door een ingelogde arts/leefstijlarts.
--   • Anonieme (portaal)gebruikers hebben geen enkele toegang.
--
-- LET OP — handmatige controle vereist:
--   RLS-policies zijn ADDITIEF (ge-OR'd). Als er in Supabase al een ruime
--   policy bestaat (bijv. "Enable all for authenticated users") op
--   storage.objects voor deze bucket, dan blijft die toegang geven. Controleer
--   na deze migratie in het Supabase Dashboard → Storage → Policies en
--   VERWIJDER eventuele oudere, te ruime policies voor 'client-documents'.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Bucket privé maken (geen publieke URL's voor medische documenten)
update storage.buckets set public = false where id = 'client-documents';

-- 2. Onze eigen policies opnieuw aanmaken (idempotent)
drop policy if exists "client-documents insert medisch" on storage.objects;
drop policy if exists "client-documents update medisch" on storage.objects;
drop policy if exists "client-documents delete medisch" on storage.objects;

-- INSERT: alleen arts/leefstijlarts mogen uploaden
create policy "client-documents insert medisch"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and exists (
      select 1 from public.vh_medewerker m
      where m.user_id = auth.uid() and m.role in ('arts', 'leefstijlarts')
    )
  );

-- UPDATE: idem (bijv. overschrijven)
create policy "client-documents update medisch"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from public.vh_medewerker m
      where m.user_id = auth.uid() and m.role in ('arts', 'leefstijlarts')
    )
  )
  with check (
    bucket_id = 'client-documents'
    and exists (
      select 1 from public.vh_medewerker m
      where m.user_id = auth.uid() and m.role in ('arts', 'leefstijlarts')
    )
  );

-- DELETE: alleen arts/leefstijlarts mogen verwijderen
create policy "client-documents delete medisch"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from public.vh_medewerker m
      where m.user_id = auth.uid() and m.role in ('arts', 'leefstijlarts')
    )
  );

-- Bewust GEEN SELECT-policy voor authenticated/anon:
-- downloaden loopt via de backend-proxy (service-role).
