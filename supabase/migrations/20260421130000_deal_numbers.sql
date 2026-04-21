-- Agency deal number prefix: 2-4 uppercase letters, globally unique.
-- Enforced at DB level so two agencies can never share a prefix.
ALTER TABLE "Agency"
  ADD COLUMN "dealNumberPrefix" TEXT,
  ADD CONSTRAINT "Agency_dealNumberPrefix_unique" UNIQUE ("dealNumberPrefix"),
  ADD CONSTRAINT "Agency_dealNumberPrefix_format" CHECK ("dealNumberPrefix" ~ '^[A-Z]{2,4}$');

-- Sequential deal number stored on each Deal (e.g. "TH-0001").
-- Null until the agency has configured a prefix.
ALTER TABLE "Deal"
  ADD COLUMN "dealNumber" TEXT;

-- Uniqueness per agency (not globally — TH-0001 and AGT-0001 can coexist).
ALTER TABLE "Deal"
  ADD CONSTRAINT "Deal_agencyId_dealNumber_unique" UNIQUE ("agencyId", "dealNumber");

-- Per-agency sequence counter.
CREATE TABLE "DealSequence" (
  "agencyId"  UUID    PRIMARY KEY REFERENCES "Agency"(id) ON DELETE CASCADE,
  "lastValue" INTEGER NOT NULL DEFAULT 0
);

-- Atomically increments and returns the next deal sequence value for an agency.
-- Uses INSERT ... ON CONFLICT DO UPDATE so the row is auto-created on first use.
CREATE OR REPLACE FUNCTION next_deal_number(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  INSERT INTO "DealSequence" ("agencyId", "lastValue")
  VALUES (p_agency_id, 1)
  ON CONFLICT ("agencyId") DO UPDATE
    SET "lastValue" = "DealSequence"."lastValue" + 1
  RETURNING "lastValue" INTO next_val;
  RETURN next_val;
END;
$$;
