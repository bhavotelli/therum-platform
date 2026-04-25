-- ============================================================
-- THE-84 follow-up: write CONTACT_REQUEST_RESOLVED audit log
-- entries when the auto-resolve trigger fires, so the create
-- → resolve loop is traceable end-to-end.
--
-- Replaces the function added in 20260425141037_contact_request_table.sql.
-- The trigger definition does not need to change; it picks up the new
-- function body on the next INSERT.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_resolve_contact_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_id uuid;
BEGIN
  FOR resolved_id IN
    UPDATE "ContactRequest"
       SET "status"            = 'RESOLVED',
           "resolvedAt"        = now(),
           "resolvedContactId" = NEW."id",
           "updatedAt"         = now()
     WHERE "clientId" = NEW."clientId"
       AND "status"   = 'OPEN'
    RETURNING "id"
  LOOP
    INSERT INTO "AdminAuditLog" ("id", "action", "targetType", "targetId", "metadata")
    VALUES (
      gen_random_uuid(),
      'CONTACT_REQUEST_RESOLVED',
      'CONTACT_REQUEST',
      resolved_id,
      jsonb_build_object(
        'clientId', NEW."clientId",
        'resolvedContactId', NEW."id",
        'auto', true
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;
