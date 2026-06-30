-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 051: public wrapper voor audit.run_all_checks()
--
-- PostgREST serveert standaard alleen het public-schema, waardoor de cron-route
-- /api/cron/audit-checks de functie audit.run_all_checks() niet kon aanroepen
-- ("Could not find the function public.run_all_checks ... in the schema cache").
-- Deze dunne wrapper in public lost dat op zonder het hele audit-schema bloot
-- te stellen aan de API.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.run_all_checks()
returns jsonb
language sql
security definer
set search_path = audit, public
as $$
  select audit.run_all_checks();
$$;

-- Belangrijk: nieuwe public-functies krijgen standaard EXECUTE voor PUBLIC.
-- Bij een SECURITY DEFINER-functie is dat een privilege-escalatierisico →
-- intrekken en uitsluitend service_role (de server-side admin client) toestaan.
revoke execute on function public.run_all_checks() from public;
grant  execute on function public.run_all_checks() to service_role;

-- PostgREST de schema-cache laten herladen zodat de functie direct bereikbaar is.
notify pgrst, 'reload schema';
