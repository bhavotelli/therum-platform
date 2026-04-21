-- ============================================================
-- Atomic issuedAt + immutability-after-approval (THE-63)
-- ============================================================
-- Two coupled changes:
--
-- 1. Move InvoiceTriplet.issuedAt into the complete_xero_push RPC
--    so it commits atomically with approvalStatus='APPROVED', the
--    Xero IDs, and Milestone.status='INVOICED'. Previously the
--    approval server action ran a separate UPDATE for issuedAt
--    *after* the RPC, meaning a post-RPC failure left the triplet
--    APPROVED with the PENDING-era placeholder issuedAt — wrong
--    invoice date on the PDF, wrong due-date math.
--
-- 2. Add a BEFORE UPDATE trigger on InvoiceTriplet that blocks any
--    change to issuedAt once approvalStatus='APPROVED'. Writes
--    during PENDING->APPROVED are permitted because OLD.approvalStatus
--    is still 'PENDING' at trigger time.

-- Drop the THE-55 signature before re-creating with the new param
-- list. CREATE OR REPLACE doesn't permit changing the parameter list.
DROP FUNCTION IF EXISTS complete_xero_push(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION complete_xero_push(
  p_triplet_id      UUID,
  p_milestone_id    UUID,
  p_issued_at       TIMESTAMPTZ,
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
    "issuedAt"       = p_issued_at,
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
  UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION complete_xero_push(
  UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- ------------------------------------------------------------
-- Immutability trigger
-- ------------------------------------------------------------
-- issuedAt is the invoice date stamped on the PDF and the basis for
-- due-date math. Once approvalStatus = 'APPROVED' it must not change.
-- The trigger permits the PENDING->APPROVED transition because the
-- row's OLD.approvalStatus is still 'PENDING' at trigger firing time.

CREATE OR REPLACE FUNCTION invoice_triplet_issued_at_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."approvalStatus" = 'APPROVED'
     AND NEW."issuedAt" IS DISTINCT FROM OLD."issuedAt" THEN
    RAISE EXCEPTION
      'InvoiceTriplet.issuedAt is immutable once approvalStatus = APPROVED (triplet %)',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_triplet_issued_at_immutable ON "InvoiceTriplet";

CREATE TRIGGER invoice_triplet_issued_at_immutable
  BEFORE UPDATE ON "InvoiceTriplet"
  FOR EACH ROW
  EXECUTE FUNCTION invoice_triplet_issued_at_immutable();
