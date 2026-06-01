-- Vita Health — Intake hervatten: check_enrollment_email RPC
-- Geeft clientstatus terug op basis van e-mailadres (security definer → bypasses RLS).
-- Uitvoeren via: Supabase Dashboard → SQL Editor

create or replace function check_enrollment_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_status      text;
  v_first_name  text;
  v_assignment  uuid;
begin
  select id, enrollment_status, first_name
  into   v_id, v_status, v_first_name
  from   vh_client
  where  lower(email) = lower(trim(p_email))
  order  by created_at desc
  limit  1;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  -- Meest recente vragenlijstkoppeling ophalen (kolom heet assigned_at)
  select id into v_assignment
  from   vh_questionnaire_assignment
  where  client_id = v_id
  order  by assigned_at desc
  limit  1;

  return jsonb_build_object(
    'exists',        true,
    'id',            v_id,
    'status',        v_status,
    'first_name',    v_first_name,
    'assignment_id', v_assignment
  );
end;
$$;

-- Toegang voor portaalgebruikers (anoniem) én medewerkers
grant execute on function check_enrollment_email(text) to anon, authenticated;
