-- Vita Health — Beveiligde intake-tokens
-- Vervangt ?email= in portaal-URLs door een onraadbare hex-token.
-- Uitvoeren via: Supabase Dashboard → SQL Editor

-- ─── Token tabel ─────────────────────────────────────────────────────────────

create table vh_intake_token (
  id         uuid        primary key default gen_random_uuid(),
  client_id  uuid        not null unique references vh_client(id) on delete cascade,
  token      text        not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

alter table vh_intake_token enable row level security;

-- Anoniem opzoeken op token (portaalpagina's)
create policy "anon select token"
  on vh_intake_token for select to anon using (true);

-- Medewerkers: alles
create policy "auth all token"
  on vh_intake_token for all to authenticated using (true) with check (true);

-- ─── RPC: intake hervatten via token ─────────────────────────────────────────

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
  select c.id, c.first_name, c.email, c.enrollment_status
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
    'email',         v_row.email,
    'status',        v_row.enrollment_status,
    'assignment_id', v_assignment_id
  );
end;
$$;

grant execute on function resolve_intake_token(text) to anon, authenticated;

-- ─── RPC: statuspagina ───────────────────────────────────────────────────────

create or replace function get_enrollment_status_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id  uuid;
  v_first_name text;
  v_status     text;
  v_registered timestamptz;
  v_kit        record;
begin
  select c.id, c.first_name, c.enrollment_status, c.created_at
  into   v_client_id, v_first_name, v_status, v_registered
  from   vh_intake_token t
  join   vh_client c on c.id = t.client_id
  where  t.token = p_token;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  -- Meest recente testkit voor datumstempels
  select status, retour_date, results_date
  into   v_kit
  from   vh_testkit
  where  assigned_client_id = v_client_id
  order  by date desc
  limit  1;

  return jsonb_build_object(
    'exists',           true,
    'first_name',       v_first_name,
    'enrollment_status',v_status,
    'registered_at',    v_registered,
    'kit_status',       v_kit.status,
    'kit_retour_date',  v_kit.retour_date,
    'kit_results_date', v_kit.results_date
  );
end;
$$;

grant execute on function get_enrollment_status_by_token(text) to anon, authenticated;
