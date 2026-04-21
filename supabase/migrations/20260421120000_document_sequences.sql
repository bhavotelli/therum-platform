-- comNumber was NOT NULL when reference numbers were Therum-generated.
-- Now that Xero auto-assigns numbers and we mirror them back after approval,
-- all reference number columns must be nullable (numbers are unknown until push).
--
-- Rollback: before re-adding NOT NULL, backfill any null comNumber rows with a
-- placeholder (e.g. UPDATE "InvoiceTriplet" SET "comNumber" = '' WHERE "comNumber" IS NULL)
-- then run: ALTER TABLE "InvoiceTriplet" ALTER COLUMN "comNumber" SET NOT NULL;
ALTER TABLE "InvoiceTriplet" ALTER COLUMN "comNumber" DROP NOT NULL;
