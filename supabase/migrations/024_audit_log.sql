-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 024: Medische auditlog
-- Conform NEN 7513: vastleggen wie wanneer welke actie uitvoerde op
-- gezondheidsgegevens, zonder medische inhoud in de log zelf op te slaan.
-- ─────────────────────────────────────────────────────────────────────────────

-- Aparte schema zodat gewone applicatierollen er niet bij kunnen
create schema if not exists audit;

-- ── Audit events tabel ────────────────────────────────────────────────────────

create table if not exists audit.vh_events (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),

  -- Wie voerde de actie uit?
  actor_user_id uuid,                          -- null = portaalgebruiker (anoniem)
  actor_role    text        not null,           -- 'medewerker' | 'medisch_deskundige' | 'portaal'
  actor_org_id  uuid,

  -- Op welke cliënt had de actie betrekking?
  subject_client_id uuid references vh_client(id) on delete set null,

  -- Welke resource?
  resource_type text not null,
  -- 'client' | 'questionnaire_response' | 'testkit' | 'batch_export'
  -- | 'consent' | 'enrollment_status' | 'kit_status'
  resource_id   uuid,

  -- Wat gebeurde er?
  action        text not null,
  -- 'view' | 'create' | 'update' | 'delete' | 'export'
  -- | 'email_sent' | 'status_change' | 'access_granted' | 'access_denied'

  -- Op welke basis?
  access_basis  text not null,
  -- 'medewerker_regulier' | 'medisch_deskundige' | 'portaal_eigen_data'
  -- | 'admin' | 'systeem'

  reason        text,                           -- optionele toelichting

  -- Technische context (gehashed — geen raw IP)
  request_id    uuid,
  ip_hash       text,
  user_agent_hash text,
  session_id_hash text,

  -- Uitkomst
  outcome       text not null check (outcome in ('success', 'denied', 'failed')),
  denial_reason text,

  -- Vrije metadata — nooit medische inhoud, alleen IDs, statussen, tellers
  metadata      jsonb not null default '{}'::jsonb
);

-- Index voor snelle opzoekingen per cliënt en per medewerker
create index on audit.vh_events (subject_client_id, created_at desc);
create index on audit.vh_events (actor_user_id,     created_at desc);
create index on audit.vh_events (action,            created_at desc);

-- ── RLS: gewone rollen mogen alleen lezen, niet schrijven/wijzigen ────────────

alter table audit.vh_events enable row level security;

-- Geauthenticeerde medewerkers mogen het auditlog inzien
create policy "medewerkers mogen auditlog lezen"
  on audit.vh_events for select
  to authenticated
  using (true);

-- Niemand mag direct updaten of verwijderen (ook niet via service-role in app)
-- Inserts lopen uitsluitend via audit.log_event() hieronder.
revoke insert, update, delete on audit.vh_events from authenticated;
revoke insert, update, delete on audit.vh_events from anon;

-- ── Veilige insert-functie (security definer) ─────────────────────────────────
-- Applicatie roept ALLEEN deze functie aan, nooit rechtstreeks insert into.

create or replace function audit.log_event(
  p_actor_user_id    uuid,
  p_actor_role       text,
  p_subject_client_id uuid,
  p_resource_type    text,
  p_resource_id      uuid,
  p_action           text,
  p_access_basis     text,
  p_reason           text,
  p_request_id       uuid,
  p_outcome          text,
  p_denial_reason    text  default null,
  p_ip_hash          text  default null,
  p_session_id_hash  text  default null,
  p_metadata         jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = audit, public
as $$
begin
  insert into audit.vh_events (
    actor_user_id, actor_role, subject_client_id,
    resource_type, resource_id,
    action, access_basis, reason,
    request_id, ip_hash, session_id_hash,
    outcome, denial_reason, metadata
  ) values (
    p_actor_user_id, p_actor_role, p_subject_client_id,
    p_resource_type, p_resource_id,
    p_action, p_access_basis, p_reason,
    p_request_id, p_ip_hash, p_session_id_hash,
    p_outcome, p_denial_reason,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Alleen service-role (backend) mag de functie aanroepen
grant execute on function audit.log_event to service_role;

-- ── Bewaartermijnen-commentaar ─────────────────────────────────────────────────
-- Medische auditlogs: minimaal 15 jaar conform NEN 7513 / zorgdossierplicht
-- (zorg dat dit ook in het verwerkingsregister en DPIA staat)
-- Automatisch verwijderen via een pg_cron job of externe taak na afstemming
-- met privacyjurist.
