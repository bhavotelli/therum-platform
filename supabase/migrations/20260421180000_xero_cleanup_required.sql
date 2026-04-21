-- If a Xero push fails mid-batch (e.g. OBI succeeds but CN fails), Therum's
-- catch block throws before persisting Xero IDs, so the triplet stays PENDING
-- while Xero has orphaned documents. A naive retry would create duplicates.
--
-- This flag is set by pushInvoiceTripletToXero when a partial write is
-- detected, and blocks retry until manually cleared (after the finance team
-- has voided any orphaned Xero documents).
--
-- Rollback:
--   DROP INDEX IF EXISTS "idx_invoice_triplet_cleanup_required";
--   ALTER TABLE "InvoiceTriplet" DROP COLUMN "xeroCleanupRequired";
ALTER TABLE "InvoiceTriplet"
  ADD COLUMN "xeroCleanupRequired" BOOLEAN NOT NULL DEFAULT false;

-- Partial index: the finance dashboard will query for triplets needing
-- cleanup. The flag should be true for a small minority of rows, so a
-- partial index keeps the index tiny and avoids a full scan.
CREATE INDEX "idx_invoice_triplet_cleanup_required"
  ON "InvoiceTriplet" ("xeroCleanupRequired")
  WHERE "xeroCleanupRequired" = true;
