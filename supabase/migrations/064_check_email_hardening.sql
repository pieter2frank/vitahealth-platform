-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 064 (P3-10-beveiliging): check_enrollment_email ontdoen van PII
--
-- Achtergrond: check_enrollment_email was anoniem aanroepbaar en gaf bij een
-- bestaand e-mailadres de VOLLEDIGE cliëntgegevens terug — naam, geboortedatum,
-- telefoon, adres én het intake-token. E-mail is geen geheim, dus iedereen die
-- een adres kende kon zo iemands PII en token opvragen (en met dat token
-- portalacties uitvoeren).
--
-- Oplossing: de functie geeft nu ALLEEN { exists } terug. Het veilig hervatten
-- loopt via een link die naar het geregistreerde adres wordt gestuurd
-- (/api/portal/resume-link) of via de token-link uit de uitnodigings-/
-- bevestigingsmail (resolve_intake_token blijft ongewijzigd — die is token-
-- gescopet en dus veilig).
--
-- Draai deze migratie samen met de bijbehorende portal-code-deploy.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function check_enrollment_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from vh_client where lower(email) = lower(trim(p_email))
  ) into v_exists;

  return jsonb_build_object('exists', v_exists);
end;
$$;

grant execute on function check_enrollment_email(text) to anon, authenticated;

notify pgrst, 'reload schema';
