-- Migratie 031: intake-token toevoegen aan resume-RPC's
-- Zodat de aanmeldpagina een link naar de statuspagina kan tonen wanneer
-- iemand al (deels) door het proces is. check_enrollment_email geeft nu
-- ook e-mail en token terug.

-- ─── 1. check_enrollment_email ───────────────────────────────────────────────

create or replace function check_enrollment_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client      record;
  v_assignment  uuid;
  v_token       text;
begin
  select id, email, enrollment_status, first_name, last_name,
         phone, birth_date, address, postal_code, city
  into   v_client
  from   vh_client
  where  lower(email) = lower(trim(p_email))
  order  by created_at desc
  limit  1;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select id into v_assignment
  from   vh_questionnaire_assignment
  where  client_id = v_client.id
  order  by assigned_at desc
  limit  1;

  -- Intake-token voor statuslink
  select token into v_token
  from   vh_intake_token
  where  client_id = v_client.id
  limit  1;

  return jsonb_build_object(
    'exists',        true,
    'id',            v_client.id,
    'email',         v_client.email,
    'status',        v_client.enrollment_status,
    'first_name',    v_client.first_name,
    'last_name',     v_client.last_name,
    'phone',         v_client.phone,
    'birth_date',    v_client.birth_date,
    'address',       v_client.address,
    'postal_code',   v_client.postal_code,
    'city',          v_client.city,
    'has_address',   (v_client.address is not null and trim(v_client.address) <> ''),
    'assignment_id', v_assignment,
    'token',         v_token
  );
end;
$$;

grant execute on function check_enrollment_email(text) to anon, authenticated;

-- ─── 2. resolve_intake_token ─────────────────────────────────────────────────

create or replace function resolve_intake_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row           record;
  v_assignment_id uuid;
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

  return jsonb_build_object(
    'exists',        true,
    'client_id',     v_row.id,
    'first_name',    v_row.first_name,
    'last_name',     v_row.last_name,
    'email',         v_row.email,
    'status',        v_row.enrollment_status,
    'phone',         v_row.phone,
    'birth_date',    v_row.birth_date,
    'address',       v_row.address,
    'postal_code',   v_row.postal_code,
    'city',          v_row.city,
    'has_address',   (v_row.address is not null and trim(v_row.address) <> ''),
    'assignment_id', v_assignment_id,
    'token',         p_token
  );
end;
$$;

grant execute on function resolve_intake_token(text) to anon, authenticated;
