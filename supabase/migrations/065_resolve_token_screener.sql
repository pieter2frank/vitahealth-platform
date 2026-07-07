-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 065: resolve_intake_token geeft ook de screener-keuze terug
--
-- Zodat de portal bij hervatten weet of de geschiktheidscheck (uitsluitings-
-- criteria) al is gedaan, en die dan overslaat i.p.v. opnieuw te tonen.
--   screener_choice = 'ok'   → verklaring 'niet_van_toepassing' (doorgaan)
--                     'hold' → verklaring 'mogelijk_van_toepassing' (on hold)
--                     null   → nog niet ingevuld
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function resolve_intake_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row           record;
  v_assignment_id uuid;
  v_declaration   text;
  v_screener      text;
begin
  select c.id, c.first_name, c.last_name, c.email, c.enrollment_status,
         c.phone, c.birth_date, c.address, c.postal_code, c.city
  into   v_row
  from   vh_intake_token t
  join   vh_client c on c.id = t.client_id
  where  t.token = p_token;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select id into v_assignment_id
  from   vh_questionnaire_assignment
  where  client_id = v_row.id
  order  by assigned_at desc
  limit  1;

  select declaration into v_declaration
  from   vh_screener_response
  where  client_id = v_row.id
  order  by created_at desc
  limit  1;

  v_screener := case v_declaration
    when 'niet_van_toepassing'    then 'ok'
    when 'mogelijk_van_toepassing' then 'hold'
    else null
  end;

  return jsonb_build_object(
    'exists',          true,
    'client_id',       v_row.id,
    'first_name',      v_row.first_name,
    'last_name',       v_row.last_name,
    'email',           v_row.email,
    'status',          v_row.enrollment_status,
    'phone',           v_row.phone,
    'birth_date',      v_row.birth_date,
    'address',         v_row.address,
    'postal_code',     v_row.postal_code,
    'city',            v_row.city,
    'has_address',     (v_row.address is not null and trim(v_row.address) <> ''),
    'assignment_id',   v_assignment_id,
    'token',           p_token,
    'screener_choice', v_screener
  );
end;
$$;

grant execute on function resolve_intake_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
