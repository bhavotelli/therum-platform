-- AlterTable
ALTER TABLE "InvoiceTriplet" ADD COLUMN     "recipientContactEmail" TEXT,
ADD COLUMN     "recipientContactName" TEXT,
ADD COLUMN     "recipientContactRole" "ContactRole";
