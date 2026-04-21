-- ============================================================
-- Atomic Xero push completion RPC (THE-48)
-- ============================================================
-- pushInvoiceTripletToXero used to perform two separate PostgREST
-- UPDATEs after a successful Xero push:
--   1. InvoiceTriplet: xero IDs + assigned reference numbers
--   2. Milestone: status = 'INVOICED'
-- The approval flow then ran a third UPDATE:
--   3. InvoiceTriplet: approvalStatus = 'APPROVED'
--
-- These three writes were not atomic. If any failed after Xero had
-- already created the documents, the DB was left inconsistent with
-- Xero. The caller masked this with a xeroCleanupRequired signal,
-- but the correct fix is to commit all three writes in one txn.
--
-- This function wraps all three writes in a single transaction.
-- SECURITY DEFINER so it bypasses RLS on InvoiceTriplet/Milestone
-- (the service role alone would still respect row-level policies).

CREATE OR REPLACE FUNCTION complete_xero_push(
  p_triplet_id      UUID,
  p_milestone_id    UUID,
  p_xero_inv_id     TEXT,
  p_xero_sbi_id     TEXT,
  p_xero_obi_id     TEXT,
  p_xero_cn_id      TEXT,
  p_xero_com_id     TEXT,
  p_inv_number      TEXT,
  p_sbi_number      TEXT,
  p_obi_number      TEXT,
  p_cn_number       TEXT,
  p_com_number      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_triplet_rows INTEGER;
  v_milestone_rows INTEGER;
BEGIN
  UPDATE "InvoiceTriplet"
  SET
    "xeroInvId"      = p_xero_inv_id,
    "xeroSbiId"      = p_xero_sbi_id,
    "xeroObiId"      = p_xero_obi_id,
    "xeroCnId"       = p_xero_cn_id,
    "xeroComId"      = p_xero_com_id,
    "invNumber"      = p_inv_number,
    "sbiNumber"      = p_sbi_number,
    "obiNumber"      = p_obi_number,
    "cnNumber"       = p_cn_number,
    "comNumber"      = p_com_number,
    "approvalStatus" = 'APPROVED'
  WHERE id = p_triplet_id
    AND "milestoneId" = p_milestone_id;

  GET DIAGNOSTICS v_triplet_rows = ROW_COUNT;
  IF v_triplet_rows <> 1 THEN
    RAISE EXCEPTION
      'complete_xero_push: expected to update exactly 1 InvoiceTriplet row for triplet=% milestone=%, got %',
      p_triplet_id, p_milestone_id, v_triplet_rows;
  END IF;

  UPDATE "Milestone"
  SET "status" = 'INVOICED'
  WHERE id = p_milestone_id;

  GET DIAGNOSTICS v_milestone_rows = ROW_COUNT;
  IF v_milestone_rows <> 1 THEN
    RAISE EXCEPTION
      'complete_xero_push: expected to update exactly 1 Milestone row for milestone=%, got %',
      p_milestone_id, v_milestone_rows;
  END IF;
END;
$$;

-- Lock down who can invoke the function. The Supabase service role runs
-- as `service_role`; anon/authenticated users must never call this directly.
REVOKE ALL ON FUNCTION complete_xero_push(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION complete_xero_push(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
