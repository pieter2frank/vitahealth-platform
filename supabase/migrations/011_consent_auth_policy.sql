-- Vita Health — ontbrekende INSERT-policy op vh_consent voor authenticated gebruikers
--
-- Waarom: de portal-aanmeldpagina gebruikt createClient() (browser).
-- Als de gebruiker tegelijkertijd ingelogd is in het dashboard (bijv. bij testen)
-- gebruikt de Supabase-client de authenticated-sessie i.p.v. anon.
-- Zonder deze policy faalt de INSERT met een RLS-fout.

create policy "auth insert consent"
  on vh_consent for insert to authenticated with check (true);
