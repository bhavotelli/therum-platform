-- DropIndex
DROP INDEX "ManualCreditNote_invoiceTripletId_key";

-- CreateIndex
CREATE INDEX "ManualCreditNote_invoiceTripletId_idx" ON "ManualCreditNote"("invoiceTripletId");
