-- Migratie 017: Supabase Realtime inschakelen voor vh_client
-- Hierdoor kunnen dashboard-medewerkers live meldingen ontvangen
-- wanneer een cliënt zich aanmeldt of de intake afrondt via het portaal.

alter publication supabase_realtime add table vh_client;
