-- Migratie 028: correcte permissies voor audit schema
-- Zorgt dat service_role daadwerkelijk kan schrijven naar audit.vh_events

-- Schema toegang
GRANT USAGE ON SCHEMA audit TO service_role;
GRANT USAGE ON SCHEMA audit TO authenticated;

-- Tabel permissies (service_role mag alles voor admin-taken)
GRANT SELECT ON audit.vh_events TO authenticated;
GRANT INSERT ON audit.vh_events TO service_role;

-- Zorg dat de public wrapper-functie correct werkt
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_actor_user_id     uuid,
  p_actor_role        text,
  p_subject_client_id uuid,
  p_resource_type     text,
  p_resource_id       uuid,
  p_action            text,
  p_access_basis      text,
  p_reason            text,
  p_request_id        uuid,
  p_outcome           text,
  p_denial_reason     text  DEFAULT NULL,
  p_ip_hash           text  DEFAULT NULL,
  p_session_id_hash   text  DEFAULT NULL,
  p_metadata          jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
BEGIN
  INSERT INTO audit.vh_events (
    actor_user_id, actor_role, subject_client_id,
    resource_type, resource_id,
    action, access_basis, reason,
    request_id, ip_hash, session_id_hash,
    outcome, denial_reason, metadata
  ) VALUES (
    p_actor_user_id, p_actor_role, p_subject_client_id,
    p_resource_type, p_resource_id,
    p_action, p_access_basis, p_reason,
    p_request_id, p_ip_hash, p_session_id_hash,
    p_outcome, p_denial_reason,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
