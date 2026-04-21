-- ============================================================
-- Atomic multi-step DB flows for server actions (THE-56)
-- ============================================================
-- Three server actions previously performed sequential PostgREST writes
-- without a surrounding transaction, so a mid-sequence failure left
-- orphaned or inconsistent rows:
--
--   1. createClientWithContacts   — Client insert + ClientContact inserts
--   2. updateClientWithContacts   — Client update + contact delete + contact inserts
--   3. createAgency               — Agency insert + auth invite + User insert
--
-- Wrap each in a single SECURITY DEFINER RPC that commits every write
-- in one transaction. See complete_xero_push (THE-48) for the pattern.
--
-- search_path is explicitly set on every function to prevent
-- schema-hijack attacks under SECURITY DEFINER.
--
-- Security model: EXECUTE is revoked from PUBLIC and granted only to
-- service_role. These RPCs are callable exclusively from server-side
-- Next.js server actions that run with the service-role key, and each
-- calling action resolves agencyId from the session (see
-- getAgencySessionContext / requireSuperAdmin) before invoking the RPC.
-- Consequently the functions intentionally do NOT perform auth.uid()
-- checks: under a service_role invocation auth.uid() is NULL, so such
-- a check would either reject every legitimate call or require a
-- bespoke bypass. Tenant isolation is enforced at the caller
-- boundary, not inside these RPCs.

-- ============================================================
-- create_client_with_contacts
-- ============================================================
-- Atomically inserts the Client row and all ClientContact rows in one txn.
-- If any contact insert fails (e.g. unique-constraint violation), the
-- Client row rolls back too. Returns the new client's UUID.
--
-- p_contacts is a JSONB array shaped:
--   [{ "name": str, "email": str, "role": str, "phone": str|null, "notes": str|null }, ...]

CREATE OR REPLACE FUNCTION create_client_with_contacts(
  p_agency_id           UUID,
  p_name                TEXT,
  p_payment_terms_days  INTEGER,
  p_vat_number          TEXT,
  p_notes               TEXT,
  p_contacts            JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_contact_rows INTEGER;
  v_expected_contacts INTEGER;
BEGIN
  IF p_contacts IS NULL OR jsonb_typeof(p_contacts) <> 'array' THEN
    RAISE EXCEPTION 'create_client_with_contacts: p_contacts must be a JSON array';
  END IF;

  v_expected_contacts := jsonb_array_length(p_contacts);
  IF v_expected_contacts = 0 THEN
    RAISE EXCEPTION 'create_client_with_contacts: at least one contact is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Agency" WHERE id = p_agency_id) THEN
    RAISE EXCEPTION 'create_client_with_contacts: agency not found';
  END IF;

  -- Reject empty/null name or email up front so we do not insert a
  -- corrupt contact that still passes the ROW_COUNT check below.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_contacts) AS c
    WHERE NULLIF(TRIM(c->>'name'), '') IS NULL
       OR NULLIF(TRIM(c->>'email'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'create_client_with_contacts: every contact must have a non-empty name and email';
  END IF;

  INSERT INTO "Client" ("agencyId", "name", "paymentTermsDays", "vatNumber", "notes")
  VALUES (p_agency_id, p_name, p_payment_terms_days, p_vat_number, p_notes)
  RETURNING id INTO v_client_id;

  INSERT INTO "ClientContact" ("agencyId", "clientId", "name", "email", "role", "phone", "notes")
  SELECT
    p_agency_id,
    v_client_id,
    TRIM((c->>'name')::TEXT),
    LOWER(TRIM((c->>'email')::TEXT)),
    (c->>'role')::TEXT,
    NULLIF(c->>'phone', ''),
    NULLIF(c->>'notes', '')
  FROM jsonb_array_elements(p_contacts) AS c;

  GET DIAGNOSTICS v_contact_rows = ROW_COUNT;
  IF v_contact_rows <> v_expected_contacts THEN
    RAISE EXCEPTION
      'create_client_with_contacts: contact row count mismatch (inserted %, expected %)',
      v_contact_rows, v_expected_contacts;
  END IF;

  RETURN v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION create_client_with_contacts(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_client_with_contacts(UUID, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;


-- ============================================================
-- update_client_with_contacts
-- ============================================================
-- Atomically updates the Client row, deletes existing ClientContact rows
-- for the client, and re-inserts the new contact set. Scoped to a single
-- agency. Raises if the Client does not exist in the given agency.

CREATE OR REPLACE FUNCTION update_client_with_contacts(
  p_agency_id           UUID,
  p_client_id           UUID,
  p_name                TEXT,
  p_payment_terms_days  INTEGER,
  p_vat_number          TEXT,
  p_notes               TEXT,
  p_contacts            JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_rows INTEGER;
  v_contact_rows INTEGER;
  v_expected_contacts INTEGER;
BEGIN
  IF p_contacts IS NULL OR jsonb_typeof(p_contacts) <> 'array' THEN
    RAISE EXCEPTION 'update_client_with_contacts: p_contacts must be a JSON array';
  END IF;

  v_expected_contacts := jsonb_array_length(p_contacts);
  IF v_expected_contacts = 0 THEN
    RAISE EXCEPTION 'update_client_with_contacts: at least one contact is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Agency" WHERE id = p_agency_id) THEN
    RAISE EXCEPTION 'update_client_with_contacts: agency not found';
  END IF;

  -- Explicit existence check up front so the error is a clean
  -- "not found" rather than leaking into downstream DELETE/INSERT.
  IF NOT EXISTS (
    SELECT 1 FROM "Client" WHERE id = p_client_id AND "agencyId" = p_agency_id
  ) THEN
    RAISE EXCEPTION 'update_client_with_contacts: client not found in agency';
  END IF;

  -- Reject empty/null name or email up front so we do not insert a
  -- corrupt contact that still passes the ROW_COUNT check below.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_contacts) AS c
    WHERE NULLIF(TRIM(c->>'name'), '') IS NULL
       OR NULLIF(TRIM(c->>'email'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'update_client_with_contacts: every contact must have a non-empty name and email';
  END IF;

  UPDATE "Client"
  SET
    "name"             = p_name,
    "paymentTermsDays" = p_payment_terms_days,
    "vatNumber"        = p_vat_number,
    "notes"            = p_notes
  WHERE id = p_client_id
    AND "agencyId" = p_agency_id;

  GET DIAGNOSTICS v_client_rows = ROW_COUNT;
  IF v_client_rows <> 1 THEN
    RAISE EXCEPTION
      'update_client_with_contacts: Client row count mismatch (updated %, expected 1)',
      v_client_rows;
  END IF;

  DELETE FROM "ClientContact"
  WHERE "clientId" = p_client_id
    AND "agencyId" = p_agency_id;

  INSERT INTO "ClientContact" ("agencyId", "clientId", "name", "email", "role", "phone", "notes")
  SELECT
    p_agency_id,
    p_client_id,
    TRIM((c->>'name')::TEXT),
    LOWER(TRIM((c->>'email')::TEXT)),
    (c->>'role')::TEXT,
    NULLIF(c->>'phone', ''),
    NULLIF(c->>'notes', '')
  FROM jsonb_array_elements(p_contacts) AS c;

  GET DIAGNOSTICS v_contact_rows = ROW_COUNT;
  IF v_contact_rows <> v_expected_contacts THEN
    RAISE EXCEPTION
      'update_client_with_contacts: contact row count mismatch (inserted %, expected %)',
      v_contact_rows, v_expected_contacts;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION update_client_with_contacts(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_client_with_contacts(UUID, UUID, TEXT, INTEGER, TEXT, TEXT, JSONB) TO service_role;


-- ============================================================
-- create_agency_with_admin
-- ============================================================
-- Atomically inserts an Agency and its first AGENCY_ADMIN User row.
-- The caller MUST have already invited the Supabase Auth user (outside
-- this tx) and pass the resulting authUserId; if this RPC raises, the
-- caller is responsible for deleting the orphan auth.users row.
--
-- Returns `{ agencyId, userId }` so the caller can continue audit logging
-- and revalidation with both IDs in hand.

CREATE OR REPLACE FUNCTION create_agency_with_admin(
  p_agency_name         TEXT,
  p_agency_slug         TEXT,
  p_invoicing_model     TEXT,
  p_vat_registered      BOOLEAN,
  p_commission_default  TEXT,
  p_auth_user_id        UUID,
  p_user_email          TEXT,
  p_user_name           TEXT,
  p_user_role           TEXT,
  p_created_by          UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
  v_user_id UUID;
BEGIN
  INSERT INTO "Agency" (
    "name",
    "slug",
    "invoicingModel",
    "vatRegistered",
    "commissionDefault"
  )
  VALUES (
    p_agency_name,
    p_agency_slug,
    p_invoicing_model,
    p_vat_registered,
    p_commission_default
  )
  RETURNING id INTO v_agency_id;

  INSERT INTO "User" (
    "agencyId",
    "authUserId",
    "role",
    "active",
    "email",
    "name",
    "inviteToken",
    "inviteExpiry",
    "createdBy"
  )
  VALUES (
    v_agency_id,
    p_auth_user_id,
    p_user_role,
    TRUE,
    p_user_email,
    p_user_name,
    NULL,
    NULL,
    p_created_by
  )
  RETURNING id INTO v_user_id;

  RETURN jsonb_build_object('agencyId', v_agency_id, 'userId', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION create_agency_with_admin(TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_agency_with_admin(TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
