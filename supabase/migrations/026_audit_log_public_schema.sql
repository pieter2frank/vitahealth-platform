-- Migratie 026: audit log_event wrapper in public schema
-- PostgREST exposeert standaard alleen functies uit het public schema.
-- Oplossing: wrapper functie in public die inserts in audit.vh_events doet.

create or replace function public.log_audit_event(
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

grant execute on function public.log_audit_event to service_role, authenticated;
