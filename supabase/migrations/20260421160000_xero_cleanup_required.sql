-- ============================================================
-- THE-37: xeroCleanupRequired flag on InvoiceTriplet
-- ============================================================
-- When a Xero push fails mid-batch (e.g. OBI created but CN fails),
-- Xero ends up with orphaned documents while the triplet stays PENDING.
-- Retrying would create duplicates. This flag blocks retry until the
-- finance team has voided the orphaned Xero documents and cleared the flag.

ALTER TABLE "InvoiceTriplet"
  ADD COLUMN "xeroCleanupRequired" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "InvoiceTriplet"."xeroCleanupRequired" IS
  'Set to true when a Xero push fails mid-batch and partial documents were
   already created in Xero. The Finance Portal surfaces a warning and blocks
   retry until this flag is manually cleared after the team has voided any
   orphaned Xero documents.';

-- ============================================================
-- Rollback (run manually if needed)
-- ============================================================
-- ALTER TABLE "InvoiceTriplet" DROP COLUMN "xeroCleanupRequired";
