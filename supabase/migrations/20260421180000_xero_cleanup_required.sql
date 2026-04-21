-- If a Xero push fails mid-batch (e.g. OBI succeeds but CN fails), Therum's
-- catch block throws before persisting Xero IDs, so the triplet stays PENDING
-- while Xero has orphaned documents. A naive retry would create duplicates.
--
-- This flag is set by pushInvoiceTripletToXero when a partial write is
-- detected, and blocks retry until manually cleared (after the finance team
-- has voided any orphaned Xero documents).
--
-- Rollback: ALTER TABLE "InvoiceTriplet" DROP COLUMN "xeroCleanupRequired";
ALTER TABLE "InvoiceTriplet"
  ADD COLUMN "xeroCleanupRequired" BOOLEAN NOT NULL DEFAULT false;
