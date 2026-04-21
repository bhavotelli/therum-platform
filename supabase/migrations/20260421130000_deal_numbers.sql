-- ============================================================
-- Deal number prefix per agency (e.g. "TH" → deals "TH-0001")
-- ============================================================

-- 2-4 uppercase letters; format enforced at DB level.
ALTER TABLE "Agency"
  ADD COLUMN "dealNumberPrefix" TEXT,
  ADD CONSTRAINT "Agency_dealNumberPrefix_format"
    CHECK ("dealNumberPrefix" ~ '^[A-Z]{2,4}$');

-- Partial unique index: NULLs are excluded so multiple agencies
-- can have no prefix, but any non-NULL prefix must be globally unique.
CREATE UNIQUE INDEX "Agency_dealNumberPrefix_unique"
  ON "Agency" ("dealNumberPrefix")
  WHERE "dealNumberPrefix" IS NOT NULL;

-- ============================================================
-- Deal number column
-- ============================================================

ALTER TABLE "Deal"
  ADD COLUMN "dealNumber" TEXT;

-- Partial unique index: only enforce uniqueness for non-NULL deal numbers
-- (two agencies can both have NULL dealNumber without conflict).
CREATE UNIQUE INDEX "Deal_agencyId_dealNumber_unique"
  ON "Deal" ("agencyId", "dealNumber")
  WHERE "dealNumber" IS NOT NULL;

-- ============================================================
-- Per-agency sequence counter
-- ============================================================

CREATE TABLE "DealSequence" (
  "agencyId"  UUID    PRIMARY KEY REFERENCES "Agency"(id) ON DELETE CASCADE,
  "lastValue" INTEGER NOT NULL DEFAULT 0
);

-- No user-level access to the sequence table; only the service role
-- (which bypasses RLS) and SECURITY DEFINER trigger functions may touch it.
ALTER TABLE "DealSequence" ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all: even users with direct SQL access cannot read or write rows.
-- The service role bypasses RLS entirely, so this never blocks trigger functions.
CREATE POLICY "deny_all_users" ON "DealSequence" FOR ALL USING (false);

-- ============================================================
-- Internal sequence helper (called by trigger only)
-- ============================================================

CREATE OR REPLACE FUNCTION _increment_deal_sequence(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO "DealSequence" ("agencyId", "lastValue")
  VALUES (p_agency_id, 1)
  ON CONFLICT ("agencyId") DO UPDATE
    SET "lastValue" = "DealSequence"."lastValue" + 1
  RETURNING "lastValue" INTO v_next;
  RETURN v_next;
END;
$$;

-- ============================================================
-- BEFORE INSERT trigger on Deal: assign dealNumber atomically
-- ============================================================
-- Fires inside the same transaction as the INSERT, so if the
-- insert rolls back the sequence counter is also rolled back.
-- Any app-supplied dealNumber is always overwritten.

CREATE OR REPLACE FUNCTION assign_deal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_seq    INTEGER;
BEGIN
  SELECT "dealNumberPrefix" INTO v_prefix
  FROM "Agency"
  WHERE id = NEW."agencyId";

  IF v_prefix IS NOT NULL THEN
    v_seq := _increment_deal_sequence(NEW."agencyId");
    NEW."dealNumber" := v_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');
  ELSE
    NEW."dealNumber" := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER deal_assign_number
  BEFORE INSERT ON "Deal"
  FOR EACH ROW
  EXECUTE FUNCTION assign_deal_number();

-- ============================================================
-- Milestone reference column (e.g. "TH-0001-M01")
-- ============================================================

ALTER TABLE "Milestone"
  ADD COLUMN "milestoneRef" TEXT;

-- ============================================================
-- BEFORE INSERT trigger on Milestone: assign milestoneRef atomically
-- ============================================================
-- The application MUST insert milestones sorted by invoiceDate ASC
-- (earliest first) so that M01 < M02 < M03 reflects chronological order.
-- Cancelled milestones are excluded from the count so cancellation +
-- replacement does not reuse a ref (the replacement gets the next slot).

CREATE OR REPLACE FUNCTION assign_milestone_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deal_number TEXT;
  v_position    INTEGER;
BEGIN
  SELECT "dealNumber" INTO v_deal_number
  FROM "Deal"
  WHERE id = NEW."dealId";

  IF v_deal_number IS NOT NULL THEN
    -- Lock the Deal row before counting to serialise concurrent milestone inserts
    -- for the same deal. Without this, two simultaneous inserts could both read
    -- COUNT(*) = N and assign the same M(N+1) ref.
    PERFORM 1 FROM "Deal" WHERE id = NEW."dealId" FOR UPDATE;

    -- Count existing non-cancelled milestones for this deal (the current
    -- row is not yet in the table at BEFORE INSERT time, so +1 gives its slot).
    SELECT COUNT(*) + 1 INTO v_position
    FROM "Milestone"
    WHERE "dealId" = NEW."dealId"
      AND "status" <> 'CANCELLED';

    NEW."milestoneRef" := v_deal_number || '-M' || LPAD(v_position::TEXT, 2, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER milestone_assign_ref
  BEFORE INSERT ON "Milestone"
  FOR EACH ROW
  EXECUTE FUNCTION assign_milestone_ref();

-- ============================================================
-- Immutability guard: dealNumberPrefix cannot change once set
-- ============================================================
-- Enforced at DB level (in addition to the application check) so a direct
-- SQL UPDATE cannot orphan existing dealNumbers and milestoneRefs.

CREATE OR REPLACE FUNCTION prevent_prefix_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."dealNumberPrefix" IS NOT NULL
     AND NEW."dealNumberPrefix" IS DISTINCT FROM OLD."dealNumberPrefix" THEN
    RAISE EXCEPTION
      'dealNumberPrefix is immutable once set (current: %). Contact engineering to migrate.',
      OLD."dealNumberPrefix";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agency_prevent_prefix_change
  BEFORE UPDATE ON "Agency"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_prefix_change();
