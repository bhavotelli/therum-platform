-- ============================================================
-- THE-37: xeroPushInProgress optimistic lock on InvoiceTriplet
-- ============================================================
-- Prevents concurrent Xero pushes from creating duplicate documents.
--
-- Two Finance users clicking Approve simultaneously on the same triplet
-- would both load xeroCleanupRequired=false and proceed to push, creating
-- duplicate invoices in Xero. This column is used as a compare-and-swap
-- lock: the push function atomically flips it true WHERE it is currently
-- false (AND xeroCleanupRequired = false). Only one of two concurrent
-- callers can succeed — the other receives a "push in progress" error.
-- The lock is always released in a finally block.

ALTER TABLE "InvoiceTriplet"
  ADD COLUMN "xeroPushInProgress" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "InvoiceTriplet"."xeroPushInProgress" IS
  'Optimistic push lock. Set to true for the duration of a Xero push via
   an atomic UPDATE ... WHERE xeroPushInProgress = false AND xeroCleanupRequired = false.
   Prevents concurrent approvals from creating duplicate Xero documents.
   Always released in a finally block after the push attempt completes.';

-- ============================================================
-- Rollback (run manually if needed)
-- ============================================================
-- ALTER TABLE "InvoiceTriplet" DROP COLUMN "xeroPushInProgress";
