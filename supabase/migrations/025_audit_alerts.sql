-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 025: Audit-alerts
-- Detecteert verdachte patronen in het auditlog en slaat alerts op.
-- Drempelwaarden (afgestemd op kleine organisatie):
--   bulk_access:          >15 cliëntdossiers ingezien in 60 minuten
--   bulk_results:         >10 vragenlijstresultaten ingezien in 30 minuten
--   bulk_export:          >3 exports door 1 medewerker in 24 uur
--   offhours_export:      export aangemaakt buiten werkuren (NL: ma-vr 07-19)
--   denied_burst:         >5 geweigerde toegangspogingen in 10 minuten
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Alerts tabel (publiek schema — leesbaar door admins) ───────────────────────

create table if not exists vh_alert (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  alert_type    text        not null,
  severity      text        not null check (severity in ('info', 'warning', 'critical')),
  title         text        not null,
  message       text        not null,
  actor_user_id uuid,
  resolved_at   timestamptz,
  resolved_by   uuid,
  metadata      jsonb       not null default '{}'::jsonb
);

create index on vh_alert (resolved_at) where resolved_at is null;
create index on vh_alert (created_at desc);

alter table vh_alert enable row level security;

-- Admins mogen lezen
create policy "admin read alerts"
  on vh_alert for select to authenticated using (true);

-- Alleen service-role mag inserten/updaten
revoke insert, update, delete on vh_alert from authenticated;
revoke insert, update, delete on vh_alert from anon;

-- ── Helper: alert aanmaken als hij nog niet recent bestaat ────────────────────

create or replace function audit.upsert_alert(
  p_alert_type    text,
  p_severity      text,
  p_title         text,
  p_message       text,
  p_actor_user_id uuid default null,
  p_metadata      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, audit
as $$
begin
  -- Voorkom dubbele alerts voor hetzelfde type/actor binnen 2 uur
  if exists (
    select 1 from vh_alert
    where alert_type    = p_alert_type
      and (actor_user_id = p_actor_user_id or (actor_user_id is null and p_actor_user_id is null))
      and resolved_at is null
      and created_at > now() - interval '2 hours'
  ) then
    return;
  end if;

  insert into vh_alert (alert_type, severity, title, message, actor_user_id, metadata)
  values (p_alert_type, p_severity, p_title, p_message, p_actor_user_id, p_metadata);
end;
$$;

-- ── Check 1: Bulk inzage cliëntdossiers (>15 views in 60 min) ────────────────

create or replace function audit.check_bulk_access()
returns int
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  r   record;
  cnt int := 0;
begin
  for r in
    select actor_user_id, count(*) as n
    from audit.vh_events
    where action = 'view'
      and resource_type = 'client'
      and created_at > now() - interval '60 minutes'
      and outcome = 'success'
    group by actor_user_id
    having count(*) > 15
  loop
    perform audit.upsert_alert(
      'bulk_access', 'warning',
      'Bulk inzage cliëntdossiers',
      format('Medewerker %s heeft in de afgelopen 60 minuten %s cliëntdossiers ingezien (drempel: 15).', r.actor_user_id, r.n),
      r.actor_user_id,
      jsonb_build_object('view_count', r.n, 'window_minutes', 60)
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── Check 2: Bulk inzage vragenlijstresultaten (>10 in 30 min) ───────────────

create or replace function audit.check_bulk_results()
returns int
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  r   record;
  cnt int := 0;
begin
  for r in
    select actor_user_id, count(*) as n
    from audit.vh_events
    where action = 'view'
      and resource_type = 'questionnaire_response'
      and created_at > now() - interval '30 minutes'
      and outcome = 'success'
    group by actor_user_id
    having count(*) > 10
  loop
    perform audit.upsert_alert(
      'bulk_results', 'warning',
      'Bulk inzage vragenlijstresultaten',
      format('Medewerker %s heeft in de afgelopen 30 minuten %s sets vragenlijstresultaten ingezien (drempel: 10).', r.actor_user_id, r.n),
      r.actor_user_id,
      jsonb_build_object('view_count', r.n, 'window_minutes', 30)
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── Check 3: Bulk export (>3 exports door 1 medewerker in 24 uur) ─────────────

create or replace function audit.check_bulk_export()
returns int
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  r   record;
  cnt int := 0;
begin
  for r in
    select actor_user_id, count(*) as n
    from audit.vh_events
    where action = 'export'
      and created_at > now() - interval '24 hours'
      and outcome = 'success'
    group by actor_user_id
    having count(*) > 3
  loop
    perform audit.upsert_alert(
      'bulk_export', 'critical',
      'Ongebruikelijk veel exports',
      format('Medewerker %s heeft in de afgelopen 24 uur %s keer geëxporteerd (drempel: 3).', r.actor_user_id, r.n),
      r.actor_user_id,
      jsonb_build_object('export_count', r.n, 'window_hours', 24)
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── Check 4: Export buiten werkuren (ma-vr 07:00-19:00 NL tijd) ──────────────

create or replace function audit.check_offhours_export()
returns int
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  r   record;
  cnt int := 0;
begin
  for r in
    select id, actor_user_id, created_at,
           extract(dow  from created_at at time zone 'Europe/Amsterdam') as dow,
           extract(hour from created_at at time zone 'Europe/Amsterdam') as hr
    from audit.vh_events
    where action = 'export'
      and outcome = 'success'
      and created_at > now() - interval '15 minutes'
      and (
        -- Weekend (0=zo, 6=za)
        extract(dow from created_at at time zone 'Europe/Amsterdam') in (0, 6)
        -- Voor 07:00
        or extract(hour from created_at at time zone 'Europe/Amsterdam') < 7
        -- Na 19:00
        or extract(hour from created_at at time zone 'Europe/Amsterdam') >= 19
      )
  loop
    perform audit.upsert_alert(
      'offhours_export', 'critical',
      'Export buiten werkuren',
      format('Er is een export aangemaakt buiten werkuren (%s).', to_char(r.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY HH24:MI')),
      r.actor_user_id,
      jsonb_build_object('event_id', r.id, 'local_time', to_char(r.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY HH24:MI'))
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── Check 5: Burst geweigerde toegang (>5 denied in 10 min) ──────────────────

create or replace function audit.check_denied_burst()
returns int
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  r   record;
  cnt int := 0;
begin
  for r in
    select actor_user_id, count(*) as n
    from audit.vh_events
    where outcome = 'denied'
      and created_at > now() - interval '10 minutes'
    group by actor_user_id
    having count(*) > 5
  loop
    perform audit.upsert_alert(
      'denied_burst', 'critical',
      'Herhaaldelijke toegangsweigering',
      format('Medewerker %s heeft in de afgelopen 10 minuten %s keer een toegangsweigering gekregen (drempel: 5).', r.actor_user_id, r.n),
      r.actor_user_id,
      jsonb_build_object('denied_count', r.n, 'window_minutes', 10)
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- ── Hoofdfunctie: alle checks uitvoeren ───────────────────────────────────────

create or replace function audit.run_all_checks()
returns jsonb
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  bulk_access  int;
  bulk_results int;
  bulk_export  int;
  offhours     int;
  denied       int;
begin
  bulk_access  := audit.check_bulk_access();
  bulk_results := audit.check_bulk_results();
  bulk_export  := audit.check_bulk_export();
  offhours     := audit.check_offhours_export();
  denied       := audit.check_denied_burst();

  return jsonb_build_object(
    'bulk_access',  bulk_access,
    'bulk_results', bulk_results,
    'bulk_export',  bulk_export,
    'offhours',     offhours,
    'denied_burst', denied,
    'total',        bulk_access + bulk_results + bulk_export + offhours + denied,
    'checked_at',   now()
  );
end;
$$;

grant execute on function audit.run_all_checks()          to service_role;
grant execute on function audit.check_bulk_access()       to service_role;
grant execute on function audit.check_bulk_results()      to service_role;
grant execute on function audit.check_bulk_export()       to service_role;
grant execute on function audit.check_offhours_export()   to service_role;
grant execute on function audit.check_denied_burst()      to service_role;
grant execute on function audit.upsert_alert(text,text,text,text,uuid,jsonb) to service_role;
