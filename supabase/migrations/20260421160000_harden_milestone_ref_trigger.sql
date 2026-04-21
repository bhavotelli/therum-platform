-- ============================================================
-- Harden assign_milestone_ref trigger definition (THE-42)
-- ============================================================
-- Follow-up to THE-38 / PR #6. Two improvements:
--
-- 1. Replace CREATE OR REPLACE with an explicit DROP TRIGGER + DROP FUNCTION
--    then CREATE. CREATE OR REPLACE keeps the old signature silently if a
--    future change alters arguments or return type — an explicit drop forces
--    the migration to fail loudly instead, protecting against silent skew.
--
-- 2. Document why the Deal → Milestone FOR UPDATE lock is deadlock-free.

DROP TRIGGER IF EXISTS milestone_assign_ref ON "Milestone";
DROP FUNCTION IF EXISTS assign_milestone_ref();

CREATE FUNCTION assign_milestone_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deal_number TEXT;
  v_position    INTEGER;
BEGIN
  -- Lock the Deal row FIRST to serialise concurrent milestone inserts for
  -- the same deal, and to guarantee we read dealNumber from a consistent
  -- post-lock snapshot rather than a potentially stale pre-lock value.
  --
  -- Lock direction is always Deal → Milestone (never the reverse), so
  -- deadlock is impossible: no code path locks a Milestone row and then
  -- waits on the parent Deal row within the same transaction.
  PERFORM 1 FROM "Deal" WHERE id = NEW."dealId" FOR UPDATE;

  -- Re-read dealNumber after acquiring the lock.
  SELECT "dealNumber" INTO v_deal_number
  FROM "Deal"
  WHERE id = NEW."dealId";

  IF v_deal_number IS NOT NULL THEN
    -- Count existing non-cancelled milestones for this deal (the current
    -- row is not yet in the table at BEFORE INSERT time, so +1 gives its slot).
    -- Concurrent inserts are safe because the FOR UPDATE above ensures only
    -- one transaction reaches this point at a time per deal.
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
