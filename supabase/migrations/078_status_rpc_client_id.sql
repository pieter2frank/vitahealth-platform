-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 078: client_id in de status-RPC (PII-kluis, fase 2)
--
-- get_enrollment_status_by_token geeft nu ook het client_id terug, zodat de
-- (server-side) statuspagina de voornaam uit de versleutelde kluis kan halen
-- in plaats van uit de RPC-payload. Het first_name-veld blijft voorlopig staan
-- (oude builds blijven werken); het verdwijnt in fase 3 samen met de kolommen.
-- Additief en veilig om te draaien naast een oudere build.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_has_order  boolean;
  v_paid_at    timestamptz;
  v_order      record;
begin
  select c.id, c.first_name, c.enrollment_status, c.created_at
  into   v_client_id, v_first_name, v_status, v_registered
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
    'first_name',       v_first_name,
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

notify pgrst, 'reload schema';
