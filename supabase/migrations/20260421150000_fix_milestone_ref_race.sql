-- ============================================================
-- Fix: assign_milestone_ref race condition (THE-38)
-- ============================================================
-- The previous implementation read dealNumber BEFORE acquiring the
-- FOR UPDATE lock on the Deal row. In the theoretical case where
-- dealNumber transitions from NULL to non-NULL between the initial
-- SELECT and the IF check, the lock would never fire and the milestone
-- could receive a ref without the position count being serialised.
--
-- Fix: acquire the FOR UPDATE lock FIRST, then re-read dealNumber from
-- the consistent post-lock snapshot before counting and assigning the ref.

CREATE OR REPLACE FUNCTION assign_milestone_ref()
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

-- ============================================================
-- Fix: misleading comment on DealSequence RLS policy (THE-38)
-- ============================================================
-- The previous comment stated "the service role bypasses RLS entirely".
-- In Supabase the service role does NOT bypass RLS by default — it still
-- respects all RLS policies. What bypasses RLS is the SECURITY DEFINER
-- attribute on _increment_deal_sequence, which causes the function to run
-- as its owner (postgres superuser) and therefore operate outside RLS.

COMMENT ON TABLE "DealSequence" IS
  'Per-agency sequence counter for deal numbering. Protected by a deny-all RLS policy.
   Only accessible via SECURITY DEFINER functions (_increment_deal_sequence) that run as
   the postgres owner and therefore bypass RLS. The Supabase service role alone would
   still be blocked by the deny_all_users policy.';
