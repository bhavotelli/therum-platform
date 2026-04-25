-- ============================================================
-- THE-84: Finance → Agency contact-request flow
--
-- Adds a new ContactRequest table so Finance users approving an
-- invoice for a client with no contacts on file can ping the agency
-- team in-app instead of falling back to Slack/email.
--
-- Auto-resolve: any new ClientContact closes ALL open requests for
-- that client (semantics: "we need somebody we can email about this
-- client's invoices" — the first contact added satisfies that).
-- ============================================================

-- 1. Status enum
CREATE TYPE "ContactRequestStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');

-- 2. Table
CREATE TABLE "ContactRequest" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId"           uuid NOT NULL REFERENCES "Agency"("id") ON DELETE CASCADE,
  "clientId"           uuid NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
  "requestedByUserId"  uuid NOT NULL REFERENCES "User"("id"),
  "requestedRole"      "ContactRole",                     -- PRIMARY/FINANCE/OTHER, nullable
  "note"               text,                              -- nullable, max 500 enforced in app
  "status"             "ContactRequestStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt"         timestamptz,
  "resolvedByUserId"   uuid REFERENCES "User"("id"),      -- null when auto-resolved by trigger
  "resolvedContactId"  uuid REFERENCES "ClientContact"("id") ON DELETE SET NULL,
  "createdAt"          timestamptz NOT NULL DEFAULT now(),
  "updatedAt"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "ContactRequest_agencyId_status_idx" ON "ContactRequest" ("agencyId", "status");
CREATE INDEX "ContactRequest_clientId_status_idx" ON "ContactRequest" ("clientId", "status");

-- 3. RLS — mirrors ClientContact's existing policy structure
ALTER TABLE "ContactRequest" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_request_agency_select"
  ON "ContactRequest"
  FOR SELECT
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "contact_request_finance_insert"
  ON "ContactRequest"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
    AND "requestedByUserId" = (auth.jwt() ->> 'sub')::uuid
  );

CREATE POLICY "contact_request_agency_update"
  ON "ContactRequest"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

-- 4. Auto-resolve trigger: when a ClientContact is inserted, mark all OPEN
--    requests for that client as RESOLVED. resolvedByUserId stays null to
--    signal "auto-resolved by contact creation"; resolvedContactId points
--    at the new contact so the agency UI can show "resolved by adding X".
CREATE OR REPLACE FUNCTION public.auto_resolve_contact_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "ContactRequest"
     SET "status"            = 'RESOLVED',
         "resolvedAt"        = now(),
         "resolvedContactId" = NEW."id",
         "updatedAt"         = now()
   WHERE "clientId" = NEW."clientId"
     AND "status"   = 'OPEN';
  RETURN NEW;
END;
$$;

CREATE TRIGGER "client_contact_auto_resolves_requests"
  AFTER INSERT ON "ClientContact"
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_contact_requests();
