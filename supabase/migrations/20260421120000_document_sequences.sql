-- comNumber was NOT NULL when reference numbers were Therum-generated.
-- Now that Xero auto-assigns numbers and we mirror them back after approval,
-- all reference number columns must be nullable (numbers are unknown until push).
ALTER TABLE "InvoiceTriplet" ALTER COLUMN "comNumber" DROP NOT NULL;
