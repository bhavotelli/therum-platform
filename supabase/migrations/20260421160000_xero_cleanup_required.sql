-- ============================================================
-- THE-37: xeroCleanupRequired + xeroPushInProgress on InvoiceTriplet
-- ============================================================
-- Both columns are added in a SINGLE migration so they are always present
-- together. Splitting them into two migrations creates a deployment window
-- where the atomic UPDATE in xero-sync.ts (which conditions on BOTH columns)
-- could fail because the second column hasn't been added yet.
--
-- xeroCleanupRequired: set to true when a Xero push fails mid-batch and
--   partial documents were already created. Blocks retry until Finance voids
--   the orphaned documents and manually clears the flag.
--
-- xeroPushInProgress: optimistic push lock. Acquired atomically via
--   UPDATE ... WHERE xeroPushInProgress = false AND xeroCleanupRequired = false
--   AND approvalStatus = 'PENDING'. Prevents concurrent approvals from both
--   pushing the same triplet and creating duplicate Xero documents.

ALTER TABLE "InvoiceTriplet"
  ADD COLUMN "xeroCleanupRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "xeroPushInProgress" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "InvoiceTriplet"."xeroCleanupRequired" IS
  'Set to true when a Xero push fails mid-batch and partial documents were
   already created in Xero. The Finance Portal surfaces a warning and blocks
   retry until this flag is manually cleared after the team has voided any
   orphaned Xero documents.';

COMMENT ON COLUMN "InvoiceTriplet"."xeroPushInProgress" IS
  'Optimistic push lock. Set to true for the duration of a Xero push via
   an atomic UPDATE ... WHERE xeroPushInProgress = false AND xeroCleanupRequired = false
   AND approvalStatus = PENDING. Prevents concurrent approvals from creating
   duplicate Xero documents. Always released in a finally block.';

-- ============================================================
-- RLS note
-- ============================================================
-- InvoiceTriplet is protected by row-level policies that filter access by
-- agencyId through the Milestone → Deal chain. New columns are part of the
-- same row and automatically inherit these row-level policies. No additional
-- column-level grants or policy changes are required.

-- ============================================================
-- Rollback (run manually if needed)
-- ============================================================
-- ALTER TABLE "InvoiceTriplet"
--   DROP COLUMN "xeroCleanupRequired",
--   DROP COLUMN "xeroPushInProgress";
