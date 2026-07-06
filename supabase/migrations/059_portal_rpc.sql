-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 059 (P0-beveiliging, deel 1 van 2): token-gescopete portal-RPC's
--
-- Achtergrond: de portal las tot nu toe rechtstreeks vh_client en
-- vh_intake_token met de publieke anon-key. Door de policies "anon read client
-- by id" en "anon select token" (beide USING (true)) kon iedereen met de
-- anon-key de VOLLEDIGE klanten- en tokentabel uitlezen. Deze RPC's vervangen
-- die directe leestoegang door SECURITY DEFINER-functies die uitsluitend de
-- rij(en) teruggeven die bij het meegegeven (onraadbare) id/token horen.
--
-- Uitvoervolgorde (belangrijk, geen downtime):
--   1. Draai DEZE migratie (voegt alleen functies toe — volledig additief).
--   2. Deploy de bijbehorende code (gebruikt deze RPC's).
--   3. Draai migratie 060 (trekt de brede anon-leespolicies in).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Nieuwe cliënt registreren vanuit de portal (vervangt anon insert + return) ──
create or replace function portal_register_client(
  p_first_name  text,
  p_last_name   text,
  p_email       text,
  p_phone       text default null,
  p_birth_date  text default null,
  p_address     text default null,
  p_postal_code text default null,
  p_city        text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into vh_client (
    first_name, last_name, email, phone, birth_date,
    address, postal_code, city, enrollment_status
  )
  values (
    trim(p_first_name), trim(p_last_name), trim(p_email),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_birth_date, '')), '')::date,
    p_address, p_postal_code, p_city, 'aangemeld'
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function portal_register_client(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ── Alle gegevens voor de publieke vragenlijstpagina op basis van assignment-id ─
-- De assignment-id is de onraadbare token voor deze pagina. De functie geeft
-- alleen de rij terug die bij dat id hoort — geen enumeratie mogelijk.
create or replace function portal_get_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'status',           a.status,
    'client_id',        a.client_id,
    'questionnaire_id', a.questionnaire_id,
    'title',            q.title,
    'json_content',     q.json_content,
    'first_name',       c.first_name,
    'last_name',        c.last_name,
    'token',            t.token
  )
  into v
  from vh_questionnaire_assignment a
  join vh_questionnaire q on q.id = a.questionnaire_id
  join vh_client       c on c.id = a.client_id
  left join vh_intake_token t on t.client_id = a.client_id
  where a.id = p_assignment_id;

  return v; -- null als niet gevonden
end;
$$;

grant execute on function portal_get_assignment(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
