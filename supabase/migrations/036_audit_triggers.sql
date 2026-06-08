-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 036: complete schrijf-auditing via database-triggers
--
-- Vangt AUTOMATISCH elke INSERT/UPDATE/DELETE op de belangrijke tabellen,
-- ongeacht of de wijziging uit de browser, een API-route of directe SQL komt.
-- Leesacties (view/download/export) blijven app-level gelogd — die kunnen
-- triggers niet zien.
--
-- Actor-bepaling (in volgorde):
--   1. app.actor_user_id (GUC, optioneel door API gezet)
--   2. auth.uid()         (browser-sessies met JWT)
--   3. actor-kolom van de rij (created_by / assigned_by / resolved_by)
--
-- Privacy: NOOIT medische inhoud opslaan. Alleen een whitelist van veilige
-- velden komt in metadata (status, rol, versie, barcode, e.d.).
-- ─────────────────────────────────────────────────────────────────────────────

-- FK op subject_client_id verwijderen: een auditlog moet de cliënt-id behouden
-- óók nadat de cliënt is verwijderd, en de trigger mag niet falen tijdens een
-- DELETE. De kolom blijft een gewone uuid (geen referentiële integriteit).
alter table audit.vh_events
  drop constraint if exists vh_events_subject_client_id_fkey;

create or replace function audit.log_table_change()
returns trigger
language plpgsql
security definer
set search_path = audit, public
as $$
declare
  v_row         jsonb;
  v_action      text;
  v_resource    text := TG_ARGV[0];
  v_client_col  text := nullif(TG_ARGV[1], '');
  v_actor_col   text := nullif(TG_ARGV[2], '');
  v_actor       uuid;
  v_actor_role  text;
  v_subject     uuid;
  v_resource_id uuid;
  v_meta        jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'create'; v_row := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update'; v_row := to_jsonb(NEW);
  else
    v_action := 'delete'; v_row := to_jsonb(OLD);
  end if;

  -- Actor bepalen
  begin
    v_actor := nullif(current_setting('app.actor_user_id', true), '')::uuid;
  exception when others then
    v_actor := null;
  end;
  if v_actor is null then
    v_actor := auth.uid();
  end if;
  if v_actor is null and v_actor_col is not null then
    begin
      v_actor := (v_row ->> v_actor_col)::uuid;
    exception when others then
      v_actor := null;
    end;
  end if;

  -- Rol van de actor
  if v_actor is not null then
    select role into v_actor_role from vh_medewerker where user_id = v_actor limit 1;
  end if;
  v_actor_role := coalesce(v_actor_role, case when v_actor is null then 'systeem' else 'medewerker' end);

  -- Subject (cliënt)
  if v_client_col is not null then
    begin
      v_subject := (v_row ->> v_client_col)::uuid;
    exception when others then
      v_subject := null;
    end;
  end if;

  begin
    v_resource_id := (v_row ->> 'id')::uuid;
  exception when others then
    v_resource_id := null;
  end;

  -- Veilige metadata (whitelist — nooit medische inhoud / vrije tekst)
  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'op',                TG_OP,
    'enrollment_status', v_row ->> 'enrollment_status',
    'status',            v_row ->> 'status',
    'role',              v_row ->> 'role',
    'version',           v_row ->> 'version',
    'declaration',       v_row ->> 'declaration',
    'barcode',           v_row ->> 'barcode',
    'badge_id',          v_row ->> 'badge_id',
    'is_active',         v_row ->> 'is_active'
  ));

  insert into audit.vh_events (
    actor_user_id, actor_role, subject_client_id,
    resource_type, resource_id, action, access_basis,
    outcome, metadata
  ) values (
    v_actor, v_actor_role, v_subject,
    v_resource, v_resource_id, v_action, v_actor_role,
    'success', v_meta
  );

  return null; -- AFTER-trigger
end;
$$;

-- ── Triggers koppelen ─────────────────────────────────────────────────────────
-- Argumenten: (resource_type, client_id-kolom, actor-kolom)

drop trigger if exists audit_change on vh_client;
create trigger audit_change after insert or update or delete on vh_client
  for each row execute function audit.log_table_change('client', 'id', '');

drop trigger if exists audit_change on vh_testkit;
create trigger audit_change after insert or update or delete on vh_testkit
  for each row execute function audit.log_table_change('testkit', 'assigned_client_id', '');

drop trigger if exists audit_change on vh_consent;
create trigger audit_change after insert or update or delete on vh_consent
  for each row execute function audit.log_table_change('consent', 'client_id', '');

drop trigger if exists audit_change on vh_consent_version;
create trigger audit_change after insert or update or delete on vh_consent_version
  for each row execute function audit.log_table_change('consent_version', '', 'created_by');

drop trigger if exists audit_change on vh_client_note;
create trigger audit_change after insert or update or delete on vh_client_note
  for each row execute function audit.log_table_change('client_note', 'client_id', '');

drop trigger if exists audit_change on vh_client_document;
create trigger audit_change after insert or update or delete on vh_client_document
  for each row execute function audit.log_table_change('client_document', 'client_id', '');

drop trigger if exists audit_change on vh_questionnaire_assignment;
create trigger audit_change after insert or update or delete on vh_questionnaire_assignment
  for each row execute function audit.log_table_change('questionnaire_assignment', 'client_id', '');

drop trigger if exists audit_change on vh_questionnaire_response;
create trigger audit_change after insert or update or delete on vh_questionnaire_response
  for each row execute function audit.log_table_change('questionnaire_response', 'client_id', '');

drop trigger if exists audit_change on vh_intake_token;
create trigger audit_change after insert or delete on vh_intake_token
  for each row execute function audit.log_table_change('intake_token', 'client_id', '');

drop trigger if exists audit_change on vh_medewerker;
create trigger audit_change after insert or update or delete on vh_medewerker
  for each row execute function audit.log_table_change('medewerker', '', '');

drop trigger if exists audit_change on vh_batch;
create trigger audit_change after insert or update or delete on vh_batch
  for each row execute function audit.log_table_change('batch', '', '');

-- subject_id kan een cliënt- óf kit-id zijn → niet in subject_client_id zetten
drop trigger if exists audit_change on vh_action_assignment;
create trigger audit_change after insert or update or delete on vh_action_assignment
  for each row execute function audit.log_table_change('action_assignment', '', 'assigned_by');

drop trigger if exists audit_change on vh_alert;
create trigger audit_change after update on vh_alert
  for each row execute function audit.log_table_change('alert', '', 'resolved_by');

drop trigger if exists audit_change on vh_order;
create trigger audit_change after insert or update or delete on vh_order
  for each row execute function audit.log_table_change('order', 'client_id', '');

drop trigger if exists audit_change on vh_company;
create trigger audit_change after insert or update or delete on vh_company
  for each row execute function audit.log_table_change('company', '', '');

drop trigger if exists audit_change on vh_arbo;
create trigger audit_change after insert or update or delete on vh_arbo
  for each row execute function audit.log_table_change('arbo', '', '');
