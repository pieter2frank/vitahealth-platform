-- Migratie 029: leesbare audit events via public schema functie
-- PostgREST exposeert alleen public schema — lezen via wrapper functie.

CREATE OR REPLACE FUNCTION public.get_audit_events(
  p_action        text    DEFAULT NULL,
  p_resource_type text    DEFAULT NULL,
  p_limit         integer DEFAULT 50,
  p_offset        integer DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  created_at        timestamptz,
  actor_user_id     uuid,
  actor_role        text,
  subject_client_id uuid,
  resource_type     text,
  resource_id       uuid,
  action            text,
  reason            text,
  outcome           text,
  denial_reason     text,
  metadata          jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.created_at,
    e.actor_user_id, e.actor_role,
    e.subject_client_id,
    e.resource_type, e.resource_id,
    e.action, e.reason, e.outcome, e.denial_reason,
    e.metadata
  FROM audit.vh_events e
  WHERE
    (p_action        IS NULL OR e.action        = p_action)
    AND (p_resource_type IS NULL OR e.resource_type = p_resource_type)
  ORDER BY e.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_audit_events(
  p_action        text DEFAULT NULL,
  p_resource_type text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM audit.vh_events e
  WHERE
    (p_action        IS NULL OR e.action        = p_action)
    AND (p_resource_type IS NULL OR e.resource_type = p_resource_type);
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_events   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_audit_events TO authenticated, service_role;
