-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 079: RPC's van PII losmaken (PII-kluis, fase 3 — stap 1 van 2)
--
-- Bereidt het droppen van de PII-kolommen voor. Na deze migratie raakt geen
-- enkele databasefunctie de oude PII-kolommen meer aan, en mogen ze leeg blijven:
--  * portal_register_client: maakt alleen nog een pseudoniem cliëntrecord aan
--    (zelfde signatuur — de PII-parameters worden genegeerd; de identiteit wordt
--    door de server route in de kluis geschreven).
--  * resolve_intake_token / get_enrollment_status_by_token / portal_get_assignment:
--    geven geen klare PII meer terug (de pagina's ontsleutelen al via de kluis).
--  * check_enrollment_email: vervallen (vervangen door /api/portal/check-email).
--  * first_name/last_name worden nullable, en het anon-updaterecht op de
--    PII-kolommen wordt ingetrokken.
--
-- VOLGORDE: eerst deze migratie draaien, dán de nieuwe build deployen, en pas
-- daarna (na backup + rooktest) migratie 080 (kolommen droppen).
-- Deze migratie zelf is niet destructief: bestaande data blijft staan.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. NOT NULL los (nieuwe registraties vullen de oude kolommen niet meer)
alter table vh_client alter column first_name drop not null;
alter table vh_client alter column last_name  drop not null;

-- 2. Anon-updaterecht op PII-kolommen intrekken (alleen enrollment_status blijft)
revoke update on vh_client from anon;
grant  update (enrollment_status) on vh_client to anon;

-- 3. portal_register_client: pseudoniem record, PII-parameters genegeerd
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
  -- PII gaat via de kluis (vh_client_identity), niet meer via deze functie.
  insert into vh_client (enrollment_status) values ('aangemeld')
  returning id into v_id;
  return v_id;
end;
$$;

-- 4. resolve_intake_token: alleen niet-PII (pagina ontsleutelt via de kluis)
create or replace function resolve_intake_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id     uuid;
  v_status        text;
  v_assignment_id uuid;
  v_declaration   text;
  v_screener      text;
begin
  select c.id, c.enrollment_status
  into   v_client_id, v_status
  from   vh_intake_token t
  join   vh_client c on c.id = t.client_id
  where  t.token = p_token;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select id into v_assignment_id
  from   vh_questionnaire_assignment
  where  client_id = v_client_id
  order  by assigned_at desc
  limit  1;

  select declaration into v_declaration
  from   vh_screener_response
  where  client_id = v_client_id
  order  by created_at desc
  limit  1;

  v_screener := case v_declaration
    when 'niet_van_toepassing'     then 'ok'
    when 'mogelijk_van_toepassing' then 'hold'
    else null
  end;

  return jsonb_build_object(
    'exists',          true,
    'client_id',       v_client_id,
    'status',          v_status,
    'assignment_id',   v_assignment_id,
    'token',           p_token,
    'screener_choice', v_screener
  );
end;
$$;

grant execute on function resolve_intake_token(text) to anon, authenticated;

-- 5. get_enrollment_status_by_token: first_name eruit (kluis levert de naam)
create or replace function get_enrollment_status_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id  uuid;
  v_status     text;
  v_registered timestamptz;
  v_kit        record;
  v_has_order  boolean;
  v_paid_at    timestamptz;
  v_order      record;
begin
  select c.id, c.enrollment_status, c.created_at
  into   v_client_id, v_status, v_registered
  from   vh_intake_token t
  join   vh_client c on c.id = t.client_id
  where  t.token = p_token;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select status, retour_date, results_date
  into   v_kit
  from   vh_testkit
  where  assigned_client_id = v_client_id
  order  by date desc
  limit  1;

  select exists (select 1 from vh_order where client_id = v_client_id) into v_has_order;
  select paid_at into v_paid_at
  from   vh_order
  where  client_id = v_client_id and status = 'paid'
  order  by paid_at desc nulls last
  limit  1;

  select status, stop_requested_at, refunded_at
  into   v_order
  from   vh_order
  where  client_id = v_client_id
  order  by created_at desc
  limit  1;

  return jsonb_build_object(
    'exists',           true,
    'client_id',        v_client_id,
    'enrollment_status',v_status,
    'registered_at',    v_registered,
    'kit_status',       v_kit.status,
    'kit_retour_date',  v_kit.retour_date,
    'kit_results_date', v_kit.results_date,
    'has_order',        coalesce(v_has_order, false),
    'paid',             (v_paid_at is not null),
    'paid_at',          v_paid_at,
    'order_status',     v_order.status,
    'stop_requested',   (v_order.stop_requested_at is not null),
    'refunded_at',      v_order.refunded_at
  );
end;
$$;

grant execute on function get_enrollment_status_by_token(text) to anon, authenticated;

-- 6. portal_get_assignment: naam eruit (pagina ontsleutelt via de kluis)
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
    'token',            t.token
  )
  into v
  from vh_questionnaire_assignment a
  join vh_questionnaire q on q.id = a.questionnaire_id
  left join vh_intake_token t on t.client_id = a.client_id
  where a.id = p_assignment_id;

  return v;
end;
$$;

grant execute on function portal_get_assignment(uuid) to anon, authenticated;

-- 7. check_enrollment_email: vervallen (vervangen door /api/portal/check-email)
drop function if exists check_enrollment_email(text);

notify pgrst, 'reload schema';
