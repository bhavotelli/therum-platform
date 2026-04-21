-- ============================================================
-- Close start-of-push race in complete_xero_push (THE-55)
-- ============================================================
-- The previous definition of complete_xero_push (THE-48) matched the
-- InvoiceTriplet row by (id, milestoneId) only. approveInvoiceTriplet
-- reads the triplet, checks approvalStatus = 'PENDING' in JS, then
-- kicks off the Xero push — so two operators clicking Approve within
-- milliseconds both pass the guard, both create full document sets in
-- Xero, and both RPCs succeed. The second RPC silently overwrites the
-- first's Xero IDs, leaving duplicates in Xero that Therum has no
-- record of.
--
-- This migration adds `AND "approvalStatus" = 'PENDING'` to the UPDATE
-- predicate, turning the second concurrent call into a 0-row update.
-- The existing ROW_COUNT check then raises, which the rpcErr branch
-- in pushInvoiceTripletToXero already handles by surfacing the live
-- Xero document IDs so the operator can void them before retrying.
--
-- When the guard trips, we emit a targeted message that distinguishes
-- "row missing" from "row not PENDING" so the caller's error surfaces
-- the race directly rather than a generic row-count mismatch.

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
  v_triplet_rows   INTEGER;
  v_milestone_rows INTEGER;
  v_current_status TEXT;
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
    AND "milestoneId" = p_milestone_id
    AND "approvalStatus" = 'PENDING';

  GET DIAGNOSTICS v_triplet_rows = ROW_COUNT;
  IF v_triplet_rows <> 1 THEN
    SELECT "approvalStatus" INTO v_current_status
    FROM "InvoiceTriplet"
    WHERE id = p_triplet_id
      AND "milestoneId" = p_milestone_id;

    IF v_current_status IS NULL THEN
      RAISE EXCEPTION
        'complete_xero_push: no InvoiceTriplet found for triplet=% milestone=%',
        p_triplet_id, p_milestone_id;
    ELSE
      RAISE EXCEPTION
        'complete_xero_push: triplet=% milestone=% is in approvalStatus=%, expected PENDING (concurrent approval race?)',
        p_triplet_id, p_milestone_id, v_current_status;
    END IF;
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

REVOKE ALL ON FUNCTION complete_xero_push(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION complete_xero_push(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
